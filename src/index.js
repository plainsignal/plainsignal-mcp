#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    ErrorCode,
    McpError
} from '@modelcontextprotocol/sdk/types.js'
import minimist from 'minimist';
import { z } from 'zod';

// Parse command line arguments
const argv = minimist(process.argv.slice(2), {
    string: ['token', 'api-base-url'],
    alias: {
        t: 'token',
        u: 'api-base-url'
    },
    default: {
        'api-base-url': 'https://app.plainsignal.com/api/v1'
    }
});

const _filterTypes = {
    'page': 2,
    'referrer_id': 3,
    'referrer_type': 4,
    'segment_country': 5,
    'segment_timezone': 6,
    'segment_navigator_language': 7,
    'segment_navigator_language_region': 8,
    'segment_device_type': 9,
    'segment_os': 10,
    'segment_browser': 11,
    'segment_browser_major_version': 12,
    'segment_window_size': 13,
    'segment_window_size_layout': 14,
    'segment_channel': 15,
    'segment_utm_source': 16,
    'segment_utm_medium': 17,
    'segment_utm_campaign': 18,
    'segment_utm_content': 19,
    'segment_utm_term': 20,
    'segment_utm_ref': 21,
    'segment_page_load_latency': 22,
    'segment_page_load_status': 23,
    'segment_page_fcp': 24,
    'segment_page_lcp': 25
}

const apiBaseURL = argv['api-base-url']

class PlainSignalStdioServer {
    constructor(accessToken_, apiBaseURL_ = apiBaseURL) {
        this.__accessToken = accessToken_
        this.__apiBaseURL = apiBaseURL_
        this.__server = new McpServer(
            {
                name: 'plainsignal-stdio-mcp-server',
                version: '0.1.0'
            },
            {
                capabilities: {
                    tools: {},
                    resources: {},
                }
            }
        )

        this._setupResourceHandlers()
        this._setupToolHandlers()
        this.__server.onerror = (error) => console.error('[Error]', error)
        process.on('SIGINT', async () => {
            await this.__server.close()
            process.exit(0)
        })
    }

    _setupResourceHandlers() {
        // Register a regular URI resource (not a template)
        this.__server.resource(
            'listDomains',  // Name
            'plainsignal://listDomains',  // URI string
            {
                name: 'List Domains',
                description: 'Get a list of available domains'
            },
            // Read callback function that will be called when this resource is accessed
            async (uri, extra) => {
                try {
                    const response = await fetch(this.__apiBaseURL + '/domains', {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${this.__accessToken}`
                        }
                    });

                    if (!response.ok) {
                        console.error(`HTTP error! status: ${response.status}`)
                        throw new McpError(ErrorCode.EXTERNAL_SERVICE_ERROR, `HTTP error! status: ${response.status}`);
                    }

                    const data = await response.json();
                    return {
                        contents: [{
                            type: 'text',
                            text: JSON.stringify(data),
                            uri: uri.href
                        }]
                    };
                } catch (error) {
                    console.error('Error fetching domains:', error);
                    if (error instanceof McpError) {
                        throw error;
                    }
                    throw new McpError(ErrorCode.INTERNAL_ERROR, `Error fetching domains: ${error.message}`);
                }
            }
        );
    }

    _setupToolHandlers() {
        const getReportSchema = {
            organizationID: z.string().describe('Organization ID'),
            domainID: z.string().describe('Domain ID'),
            periodFrom: z.string().describe('Report start datetime in RFC3339 format'),
            periodTo: z.string().describe('Report end datatime in RFC3339 format'),
            periodSelection: z.string().describe('If user wants to a complete month of data like April\'s data then the value should be m, else if the user wants to see a whole year\'s data then the value should be y else the value should be d. The available values are d, m and y where Month: m, Year: y, Day: d.'),
            aggregationWindow: z.string().describe('Data aggregation window. Use h for single day report or anything less than or equal to 1 day, for anything else use daily aggregation. Acceptable values, Day: d, Hour: h'),
            filters: z.array(
                z.object({
                    key: z.string(),
                    values: z.array(z.string())
                })
            ).optional().describe('List of filters which is a dictionary of key and values pair. Example filter: {"key": "", "values":["val1", "val2"]}')
        };

        this.__server.tool('getReport',
            'Get an analytics report',
            getReportSchema,
            async (parameters) => {
                return await this.getReport(
                    parameters.organizationID,
                    parameters.domainID,
                    parameters.periodFrom,
                    parameters.periodTo,
                    parameters.periodSelection,
                    parameters.aggregationWindow,
                    parameters.filters
                );
            }
        );

        const paginationSchema = z.object({
            limit: z.number().optional().describe('Number of records to return; default is 1000'),
            offset: z.number().optional().describe('Offset to start for the records; default 0')
        }).optional();
        const getSubReportSchema = {
            organizationID: z.string().describe('Organization ID'),
            domainID: z.string().describe('Domain ID'),
            periodFrom: z.string().describe('Report start datetime in RFC3339 formatted timestamp'),
            periodTo: z.string().describe('Report end datatime in RFC3339 formatted timestamp'),
            periodSelection: z.string().describe('If user wants to a complete month of data like April\'s data then the value should be m, else if the user wants to see a whole year\'s data then the value should be y else the value should be d. The available values are d, m and y where Month: m, Year: y, Day: d.'),
            aggregationWindow: z.string().describe('Data aggregation window. Use h for single day report or anything less than or equal to 1 day, for anything else use daily aggregation. Acceptable values, Day: d, Hour: h'),
            subReportType: z.string().describe('Report types are enumeration of values: 1 for page, 2 for entry page, 3 for exit page, 4 for country, 5 for timezone, 6 for navigator language, 7 for referrer, 8 for channel, 9 for utm source, 10 for utm medium, 11 for utm campaign, 12 for utm content, 13 for utm term, 14 for utm ref, 15 for device type, 16 for browser, 17 for os, 18 for status code, 19 for page load latency, 20 for page FCP, 21 for page LCP'),
            filters: z.array(
                z.object({
                    key: z.string().describe('The available keys are ' + Object.keys(_filterTypes).join(', ')),
                    values: z.array(z.string())
                })
            ).optional().describe('List of filters which is a dictionary of key and values pair. Example filter: {"key": "", "values":["000000001", "000000002"]}'),
            pagination: paginationSchema
        };

        this.__server.tool('getSubReport',
            'List top N items for the sub section of a report',
            getSubReportSchema,
            async (parameters) => {
                return await this.getSubReport(
                    parameters.organizationID,
                    parameters.domainID,
                    parameters.periodFrom,
                    parameters.periodTo,
                    parameters.periodSelection,
                    parameters.aggregationWindow,
                    parameters.subReportType,
                    parameters.filters,
                    parameters.pagination
                );
            }
        );
    }

    connect(args) {
        this.__server.connect(args)
    }

    async getReport(organizationID, domainID, periodFrom, periodTo, periodSelection, aggregationWindow, filters) {
        try {
            const queryParams = new URLSearchParams({
                period_from: periodFrom,
                period_to: periodTo,
                period_selection: periodSelection,
                aggregation_window: aggregationWindow,
            });

            if (filters && filters.length > 0) {
                filters.forEach(filter => {
                    if (!(filter.key in _filterTypes)) {
                        throw new McpError(ErrorCode.InvalidParams, `Invalid filter key, available keys are ${Object.keys(_filterTypes)}`);
                    }
                    queryParams.append(_filterTypes[filter.key], filter.values.join(','));
                });
            }

            const url = `${this.__apiBaseURL}/organizations/${organizationID}/domains/${domainID}/analytics?${queryParams}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.__accessToken}`
                }
            });

            if (!response.ok) {
                throw new McpError(ErrorCode.EXTERNAL_SERVICE_ERROR, `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(data)
                    }
                ]
            };

        } catch (error) {
            console.error('Error fetching report:', error);
            if (error instanceof McpError) {
                throw error;
            }
            throw new McpError(ErrorCode.INTERNAL_ERROR, error.message);
        }
    }

    async getSubReport(organizationID, domainID, periodFrom, periodTo, periodSelection, aggregationWindow, subReportType, filters, pagination) {
        try {
            const queryParams = new URLSearchParams({
                period_from: periodFrom,
                period_to: periodTo,
                period_selection: periodSelection,
                aggregation_window: aggregationWindow,
                stat_type: subReportType
            });

            if (filters && filters.length > 0) {
                filters.forEach(filter => {
                    if (!(filter.key in _filterTypes)) {
                        throw new McpError(ErrorCode.InvalidParams, `Invalid filter key, available keys are ${Object.keys(_filterTypes)}`);
                    }
                    queryParams.append(_filterTypes[filter.key], filter.values.join(','));
                });
            }

            if (pagination) {
                if (pagination.limit) {
                    queryParams.append('limit', pagination.limit.toString());
                }
                if (pagination.offset) {
                    queryParams.append('offset', pagination.offset.toString());
                }
            }

            const url = `${this.__apiBaseURL}/organizations/${organizationID}/domains/${domainID}/counts?${queryParams}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.__accessToken}`
                }
            });

            if (!response.ok) {
                throw new McpError(ErrorCode.EXTERNAL_SERVICE_ERROR, `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(data)
                    }
                ]
            };

        } catch (error) {
            console.error('Error fetching report:', error);
            if (error instanceof McpError) {
                throw error;
            }
            throw new McpError(ErrorCode.INTERNAL_ERROR, error.message);
        }
    }

    async run() {
        const transport = new StdioServerTransport();
        await this.__server.connect(transport);
    }
}

const server = new PlainSignalStdioServer(argv.token, apiBaseURL);
if (!argv.token) {
    console.error('Error: Access token is required');
    console.error('Usage: node src/index.js --token <access_token> [--api-base-url <api_base_url>]');
    console.error('   or: node src/index.js -t <access_token> [-u <api_base_url>]');
    console.error('Default API base URL: http://app.plainsignal.com/api/v1');
    process.exit(1);
}
await server.run().catch(console.error);
