#!/usr/bin/env node

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
const { Builder, By, Key, until, Actions } = pkg;
import { application } from "express";


// Create an MCP server
const server = new McpServer({
    name: "MCP DevOps Plan",
    version: "1.0.0"
});

const personal_access_token_string = "Y2hyaXN0b3BoZXIuaGFnZ2FuQGNvbXBhbnkuY29tOmFlOTNhMGVlLTQ3NmQtNDgwYy04ZGMxLWQ2MTE5NWY5NDgwYzpEZW1vTDo3NTg0ZTQxNi02ODczLTQ4MTAtOTdlYy1kZjIzZGRkY2Y2Nzk6-9b5QnQUNcq9oSwpxxv9uYWMQaJ5G3c7bWqsxB6l4ULilai-WxXBh5BK3jHwwBpFiFzITgYvcfX6bE52MuqXqUb4nBcF5COUP08YswPeqNGcL93Dip1uToxF-LaikEfzImmP5zcu8dvrw3W3IAwZDeGyd0AqQixhf7d--ZMj4K8=";
const serverURL = "https://devops-automation.platform-staging1.us-east.containers.appdomain.cloud/plan";
const teamspaceID = "b9705781-6e45-48fd-83fa-c9b226f0e711";
//const projectId = "VBooking";
var globalCookies = "";

async function getCookiesFromServer(serverURL) {
    try {
        let response = await fetch(`${serverURL}/ccmweb/rest/analytics/serverurl`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            console.error('Failed to fetch cookies:', response.statusText);
            return null;
        }

        const cookies = response.headers.get('set-cookie');
        if (!cookies || cookies.length === 0) {
            console.error('No cookies found in the response.');
            return null;
        }

        //let formattedCookies = cookies.map(cookie => cookie.split(';')[0]).join('; ');
        globalCookies = cookies; // Store cookies globally
        return cookies;
    } catch (error) {
        console.error('Error fetching cookies:', error);
        return null;
    }
}

// Cleanup handler
async function cleanup() {
    process.exit(0);
}

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

// Tool to get projects from Plan
server.tool(
    "deploy_application",
    "Deploy a specified appliction to a given environment, optionally with a specific version or snapshot",
    {
        application: z.string().describe("Name of the application"),
        environment: z.string().describe("Name of the environment"),
        versionSnap: z.string().describe("Version or snapshot of the application").optional()
    },
    async ({ application }) => {
        try {
            if (!globalCookies) {
                globalCookies = await getCookiesFromServer(serverURL);
                if (!globalCookies) {
                    console.error("Failed to retrieve cookies from server.");
                    return { error: "Failed to retrieve cookies." };
                }
                console.log("Received Cookies:", globalCookies);
            } else {
                console.log("Reusing Stored Cookies:", globalCookies);
            }

            const queryPayload = {
                queryDef: {
                    primaryEntityDefName: "Project",
                    queryFieldDefs: [
                        { fieldPathName: "dbid", isShown: true, sortType: "SORT_DESC" },
                        { fieldPathName: "Name", isShown: true },
                        { fieldPathName: "DescriptionPT", isShown: true }
                    ],
                    filterNode: {
                        boolOp: "BOOL_OP_AND",
                        fieldFilters: [],
                        childFilterNodes: []
                    }
                },
                resultSetOptions: {}
            };

            const queryResponse = await fetch(`${serverURL}/deploy?app=sdfdsfds`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${personal_access_token_string}`,
                    'Cookie': globalCookies
                },
                body: JSON.stringify(queryPayload)
            });

            const queryData = await queryResponse.json();
            const resultSetId = queryData.result_set_id;

            if (!resultSetId) {
                throw new Error("Failed to retrieve result set ID");
            }

            const projectsResponse = await fetch(`${serverURL}/ccmweb/rest/repos/${teamspaceID}/databases/${application}/query/${resultSetId}?pageNumber=1`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${personal_access_token_string}`,
                    'Cookie': globalCookies
                }
            });

            const projectsData = await projectsResponse.json();

            if (projectsData && projectsData.rows) {
                const projectNames = projectsData.rows.map(row => row.displayName);
                return {
                    content: [{ type: 'text', text: `Projects retrieved: ${JSON.stringify(projectNames)}` }]
                };
            } else {
                throw new Error("Failed to retrieve projects");
            }
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error retrieving projects: ${e.message}` }]
            };
        }
    }
)
// Start the server
// Tool to get projects from Plan
server.tool(
    "get_available_projects",
    "Get the list of projects in Plan for a given application",
    {
        application: z.string().describe("Name of the application")
    },
    async ({ application }) => {
        try {
            if (!globalCookies) {
                globalCookies = await getCookiesFromServer(serverURL);
                if (!globalCookies) {
                    console.error("Failed to retrieve cookies from server.");
                    return { error: "Failed to retrieve cookies." };
                }
                console.log("Received Cookies:", globalCookies);
            } else {
                console.log("Reusing Stored Cookies:", globalCookies);
            }

            const queryPayload = {
                queryDef: {
                    primaryEntityDefName: "Project",
                    queryFieldDefs: [
                        { fieldPathName: "dbid", isShown: true, sortType: "SORT_DESC" },
                        { fieldPathName: "Name", isShown: true },
                        { fieldPathName: "DescriptionPT", isShown: true }
                    ],
                    filterNode: {
                        boolOp: "BOOL_OP_AND",
                        fieldFilters: [],
                        childFilterNodes: []
                    }
                },
                resultSetOptions: {}
            };

            const queryResponse = await fetch(`${serverURL}/ccmweb/rest/repos/${teamspaceID}/databases/${application}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${personal_access_token_string}`,
                    'Cookie': globalCookies
                },
                body: JSON.stringify(queryPayload)
            });

            const queryData = await queryResponse.json();
            const resultSetId = queryData.result_set_id;

            if (!resultSetId) {
                throw new Error("Failed to retrieve result set ID");
            }

            const projectsResponse = await fetch(`${serverURL}/ccmweb/rest/repos/${teamspaceID}/databases/${application}/query/${resultSetId}?pageNumber=1`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${personal_access_token_string}`,
                    'Cookie': globalCookies
                }
            });

            const projectsData = await projectsResponse.json();

            if (projectsData && projectsData.rows) {
                const projectNames = projectsData.rows.map(row => row.displayName);
                return {
                    content: [{ type: 'text', text: `Projects retrieved: ${JSON.stringify(projectNames)}` }]
                };
            } else {
                throw new Error("Failed to retrieve projects");
            }
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error retrieving projects: ${e.message}` }]
            };
        }
    }
)

// Tool to create a work item in Plan
server.tool(
    "get_available_components",
    "Get the list of components for a project in Plan for a given application",
    {
        application: z.string().describe("Name of the application"),
        projectId: z.string().describe("ID of the project")
    },
    async ({ application, projectId }) => {
        try {
            if (!globalCookies) {
                globalCookies = await getCookiesFromServer(serverURL);
                if (!globalCookies) {
                    console.error("Failed to retrieve cookies from server.");
                    return { error: "Failed to retrieve cookies." };
                }
                console.log("Received Cookies:", globalCookies);
            } else {
                console.log("Reusing Stored Cookies:", globalCookies);
            }

            const queryPayload = {
                queryDef: {
                    primaryEntityDefName: "Component",
                    queryFieldDefs: [
                        { fieldPathName: "Name", isShown: true, sortOrder: 0 },
                        { fieldPathName: "dbid", isShown: true, sortOrder: 0 },
                        { fieldPathName: "record_type", isShown: true, sortOrder: 0 }
                    ],
                    filterNode: {
                        boolOp: "BOOL_OP_AND",
                        fieldFilters: [
                            { fieldPath: "dbid", compOp: "COMP_OP_IN", values: ["33554532", "33554531"] }
                        ],
                        childFilterNodes: []
                    }
                },
                resultSetOptions: {
                    convertToLocalTime: false,
                    maxResultSetRows: 10000,
                    pageSize: 10000
                }
            };

            const queryResponse = await fetch(`${serverURL}/ccmweb/rest/repos/${teamspaceID}/databases/${application}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${personal_access_token_string}`,
                    'Cookie': globalCookies
                },
                body: JSON.stringify(queryPayload)
            });

            const queryData = await queryResponse.json();
            const resultSetId = queryData.result_set_id;

            if (!resultSetId) {
                throw new Error("Failed to retrieve result set ID");
            }

            const componentsResponse = await fetch(`${serverURL}/ccmweb/rest/repos/${teamspaceID}/databases/${application}/query/${resultSetId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${personal_access_token_string}`,
                    'Cookie': globalCookies
                }
            });

            const componentsData = await componentsResponse.json();

            if (componentsData && componentsData.rows) {
                const componentNames = componentsData.rows.map(row => row.displayName);
                return {
                    content: [{ type: 'text', text: `Components retrieved: ${JSON.stringify(componentNames)}` }]
                };
            } else {
                throw new Error("Failed to retrieve components");
            }
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error retrieving components: ${e.message}` }]
            };
        }
    }
)

    // Tool to create a work item in Plan
server.tool(
    "get_available_workitem_types",
    "Get the available workitem types for a project in Plan for a given application",
    {
        application: z.string().describe("Name of the application"),
        projectId: z.string().describe("ID of the project")
    },
    async ({ application }) => {
        try {
            if (!globalCookies) {
                globalCookies = await getCookiesFromServer(serverURL);
                if (!globalCookies) {
                    console.error("Failed to retrieve cookies from server.");
                    return { error: "Failed to retrieve cookies." };
                }
                console.log("Received Cookies:", globalCookies);
            } else {
                console.log("Reusing Stored Cookies:", globalCookies);
            }

            const queryPayload = {
                queryDef: {
                    primaryEntityDefName: "Project",
                    queryFieldDefs: [
                        { fieldPathName: "dbid", isShown: true, sortType: "SORT_DESC" },
                        { fieldPathName: "Name", isShown: true },
                        { fieldPathName: "WITypeList", isShown: true }
                    ],
                    filterNode: {
                        boolOp: "BOOL_OP_AND",
                        fieldFilters: [],
                        childFilterNodes: []
                    }
                },
                resultSetOptions: {}
            };

            const queryResponse = await fetch(`${serverURL}/ccmweb/rest/repos/${teamspaceID}/databases/${application}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${personal_access_token_string}`,
                    'Cookie': globalCookies
                },
                body: JSON.stringify(queryPayload)
            });

            const queryData = await queryResponse.json();
            const resultSetId = queryData.result_set_id;

            if (!resultSetId) {
                throw new Error("Failed to retrieve result set ID");
            }

            const workItemTypesResponse = await fetch(`${serverURL}/ccmweb/rest/repos/${teamspaceID}/databases/${application}/query/${resultSetId}?pageNumber=1`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${personal_access_token_string}`,
                    'Cookie': globalCookies
                }
            });

            const workItemTypesData = await workItemTypesResponse.json();

            if (workItemTypesData && workItemTypesData.rows) {
                const workItemTypes = workItemTypesData.rows.map(row => {
                    const typesString = row.values[2]; // Assuming WITypeList is at index 2
                    return typesString.split('\n').map(type => type.trim());
                }).flat();

                return {
                    content: [{ type: 'text', text: `Available work item types: ${JSON.stringify(workItemTypes)}` }]
                };
            } else {
                throw new Error("Failed to retrieve work item types");
            }
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error retrieving work item types: ${e.message}` }]
            };
        }
    }
)

// Tool to create a work item in Plan
server.tool(
    "create_work_item",
    "Creates a new work item in Plan",
    {
        component: z.string().describe("A component name from the list of components in the project"),
        title: z.string().describe("Title of the work item"),
        description: z.string().describe("Description of the work item"),
        workItemType: z.string().describe("Type of the work item from the list of available work item types"),
        application: z.string().describe("Name of the application")
    },
    async ({ component, title, description, workItemType, application }) => {
        try {
            if (!globalCookies) {
                globalCookies = await getCookiesFromServer(serverURL);
                if (!globalCookies) {
                    console.error("Failed to retrieve cookies from server.");
                    return { error: "Failed to retrieve cookies." };
                }
                console.log("Received Cookies:", globalCookies);
            } else {
                console.log("Reusing Stored Cookies:", globalCookies);
            }
            let bodyJSON = JSON.parse(createWorkItemBody);
            bodyJSON.fields[0].value = component;
            bodyJSON.fields[0].valueAsList[0] = component;
            bodyJSON.fields[2].value = projectId;
            bodyJSON.fields[2].valueAsList[0] = projectId;
            bodyJSON.fields[4].value = title;
            bodyJSON.fields[4].valueAsList[0] = title;
            bodyJSON.fields[5].value = description;
            bodyJSON.fields[5].valueAsList[0] = description;
            bodyJSON.fields[6].value = workItemType;
            bodyJSON.fields[6].valueAsList[0] = workItemType;
            let body = JSON.stringify(bodyJSON);

            const response = await fetch(`${serverURL}/ccmweb/rest/repos/${teamspaceID}/databases/${application}/records/WorkItem/?operation=Commit&useDbid=false`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Basic ${personal_access_token_string}`,
                    'Cookie': globalCookies
                },
                body: body
            });

            const data = await response.json();
            if (data.viewURL) {
                return {
                    content: [{ type: 'text', text: `Work item created successfully. View it at: ${serverURL}/#${data.viewURL}` }]
                };
            } else {
                throw new Error("Failed to create work item");
            }
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error creating work item: ${e.message}` }]
            };
        }
    }
);

// Tool to retrieve all work items for a project
server.tool(
    "get_work_items",
    "Retrieves all work items for a given application",
    {
        applicationName: z.string().describe("Name of the application"),
    },
    async ({ applicationName }) => {
        try {
            if (!globalCookies) {
                globalCookies = await getCookiesFromServer(serverURL);
                if (!globalCookies) {
                    console.error("Failed to retrieve cookies from server.");
                    return { error: "Failed to retrieve cookies." };
                }
                console.log("Received Cookies:", globalCookies); // Print cookies after receiving
            } else {
                console.log("Reusing Stored Cookies:", globalCookies); // Print when reusing stored cookies
            }
            console.log(`${serverURL}/ccmweb/rest/repos/${teamspaceID}/databases/${applicationName}/query`);
            // First API call to get result_set_id
            const queryPayload = {
                queryDef: {
                    primaryEntityDefName: "WorkItem",
                    stateDriven: true,
                    showWipLimits: true,
                    laneQueryDef: {
                        pageCounterQueryField: "State",
                        pageCounterQueryFieldPath: "State",
                        wipLimitFilterQueryField: "Project"
                    },
                    queryFieldDefs: [
                        { fieldPathName: "dbid", isShown: true },
                        { fieldPathName: "State", isShown: true },
                        { fieldPathName: "id", isShown: true },
                        { fieldPathName: "Title", isShown: true },
                        { fieldPathName: "Owner.fullname", isShown: true },
                        { fieldPathName: "Owner", isShown: true },
                        { fieldPathName: "Priority", isShown: true },
                        { fieldPathName: "Parent.Title", isShown: true },
                        { fieldPathName: "Parent", isShown: true },
                        { fieldPathName: "Parent.record_type", isShown: true },
                        { fieldPathName: "Tags", isShown: true },
                        { fieldPathName: "WIType", isShown: true },
                        { fieldPathName: "State", isShown: true }
                    ],
                    filterNode: {
                        boolOp: "BOOL_OP_AND",
                        fieldFilters: [
                            { fieldPath: "Owner", compOp: "COMP_OP_EQ", values: ["[CURRENT_USER]"] },
                            { fieldPath: "Project", compOp: "COMP_OP_EQ", values: [projectId] }
                        ]
                    }
                },
                resultSetOptions: {
                    pageSize: 300,
                    convertToLocalTime: true
                }
            };

            const queryResponse = await fetch(`${serverURL}/ccmweb/rest/repos/${teamspaceID}/databases/${applicationName}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${personal_access_token_string}`,
                    'Cookie': globalCookies
                },
                body: JSON.stringify(queryPayload)
            });

            const queryData = await queryResponse.json();
            const resultSetId = queryData.result_set_id;

            if (!resultSetId) {
                throw new Error("Failed to retrieve result set ID");
            }

            // Second API call to fetch work items
            const workItemsResponse = await fetch(`${serverURL}/ccmweb/rest/repos/${teamspaceID}/databases/${applicationName}/query/${resultSetId}?pageNumber=1`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${personal_access_token_string}`,
                    'Cookie': globalCookies
                }
            });

            const workItemsData = await workItemsResponse.json();

            if (workItemsData) {
                return {
                    content: [{ type: 'text', text: `Work items retrieved: ${JSON.stringify(workItemsData)}` }]
                };
            } else {
                throw new Error("Failed to retrieve work items");
            }
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error retrieving work items: ${e.message}` }]
            };
        }
    }
);

// Tool to delete a work item
server.tool(
    "delete_work_item",
    "Deletes a work item in Plan",
    {
        workItemId: z.string().describe("ID of the work item to delete")
    },
    async ({ workItemId }) => {
        try {
            if (!globalCookies) {
                globalCookies = await getCookiesFromServer(serverURL);
                if (!globalCookies) {
                        console.error("Failed to retrieve cookies from server.");
                        return { error: "Failed to retrieve cookies." };
                    }
                    console.log("Received Cookies:", globalCookies); // Print cookies after receiving
            } else {
                console.log("Reusing Stored Cookies:", globalCookies); // Print when reusing stored cookies
            }
            const response = await fetch(`${serverURL}/ccmweb/rest/repos/${teamspaceID}/databases/${application}/records/WorkItem/${workItemId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${personal_access_token_string}`,
                    'Cookie': globalCookies
                }
            });

            if (response.ok) {
                return {
                    content: [{ type: 'text', text: `Work item ${workItemId} deleted successfully` }]
                };
            } else {
                throw new Error("Failed to delete work item");
            }
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error deleting work item: ${e.message}` }]
            };
        }
    }
);

server.tool(
    "get_applications",
    "Retrieves all applications from the Plan system",
    {},
    async () => {
        try {
            if (!globalCookies) {
                globalCookies = await getCookiesFromServer(serverURL);
                if (!globalCookies) {
                    console.error("Failed to retrieve cookies from server.");
                    return { error: "Failed to retrieve cookies." };
                }
                console.log("Received Cookies:", globalCookies); // Print cookies after receiving
            } else {
                console.log("Reusing Stored Cookies:", globalCookies); // Print when reusing stored cookies
            }
            const response = await fetch(`${serverURL}/ccmweb/rest/repos/${teamspaceID}/databases`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Basic ${personal_access_token_string}`,
                    'Cookie': globalCookies
                }
            });

            const data = await response.json();

            if (data && Array.isArray(data)) {
                const applications = data.map(app => ({
                    id: app.dbId,
                    applicationName: app.name
                }));

                return {
                    content: [
                        { type: 'text', text: `Applications retrieved: ${JSON.stringify(applications)}` },
                        { type: 'json', json: applications }
                    ]
                };
            } else {
                throw new Error("Failed to retrieve applications");
            }
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error retrieving applications: ${e.message}` }]
            };
        }
    }
);

const transport = new StdioServerTransport();
await server.connect(transport);


//Request body to create work item
const createWorkItemBody = `
{
  "dbId": "33554505",
  "displayName": "string",
  "entityDefName": "Project",
  "fields": [
      {
      "name": "Component",
      "value": "Devops Extension",
      "valueStatus": "HAS_VALUE",
      "validationStatus": "_KNOWN_VALID",
      "requiredness": "READONLY",
      "requirednessForUser": "READONLY",
      "type": "REFERENCE",
      "valueAsList": [
        "Devops Extension"
      ],
      "messageText": "",
      "maxLength": 0
    },
    {
      "name": "dbid",
      "value": "33554505",
      "valueStatus": "HAS_VALUE",
      "validationStatus": "_KNOWN_VALID",
      "requiredness": "READONLY",
      "requirednessForUser": "READONLY",
      "type": "DBID",
      "valueAsList": [
        "33554505"
      ],
      "messageText": "",
      "maxLength": 0
    },
    {
      "name": "Project",
      "value": "Devops Code",
      "valueStatus": "HAS_VALUE",
      "validationStatus": "_KNOWN_VALID",
      "requiredness": "READONLY",
      "requirednessForUser": "READONLY",
      "type": "REFERENCE",
      "valueAsList": [
        "Devops Code"
      ],
      "messageText": "",
      "maxLength": 0
    },
    {
      "name": "record_type",
      "value": "WorkItem",
      "valueStatus": "HAS_VALUE",
      "validationStatus": "_KNOWN_VALID",
      "requiredness": "READONLY",
      "requirednessForUser": "READONLY",
      "type": "RECORDTYPE",
      "valueAsList": [
        "WorkItem"
      ],
      "messageText": "",
      "maxLength": 30
    },
    {
      "name": "Title",
      "value": "Plan Item",
      "valueStatus": "HAS_VALUE",
      "validationStatus": "_KNOWN_VALID",
      "requiredness": "READONLY",
      "requirednessForUser": "READONLY",
      "type": "SHORT_STRING",
      "valueAsList": [
        "Plan Item"
      ],
      "messageText": "",
      "maxLength": 254
    },
	{
      "name": "Description",
      "value": "Plan Item",
      "valueStatus": "HAS_VALUE",
      "validationStatus": "_KNOWN_VALID",
      "requiredness": "READONLY",
      "requirednessForUser": "READONLY",
      "type": "MULTILINE_STRING",
      "valueAsList": [
        "Plan Item"
      ],
      "messageText": "",
      "maxLength": 0
    },
    {
      "name": "WIType",
      "value": "Task",
      "valueStatus": "HAS_VALUE",
      "validationStatus": "_KNOWN_VALID",
      "requiredness": "READONLY",
      "requirednessForUser": "READONLY",
      "type": "SHORT_STRING",
      "valueAsList": [
        "Task"
      ],
      "messageText": "",
      "maxLength": 254
    }
  ],
  "legalActions": [
    {
      "actionName": "Submit",
      "formDefName": "Defect_Base_Submit"
    }
  ],
  "isEditable": true,
  "isDuplicate": true,
  "original": {
    "dbId": "33554524",
    "displayName": "string",
    "entityDefName": "Project",
    "viewURL": "string"
  },
  "isOriginal": true,
  "hasDuplicates": true,
  "errorMessage": "string",
  "duplicates": [
    {
      "child": {
        "dbId": "33554524",
        "displayName": "string",
        "entityDefName": "Project",
        "viewURL": "string"
      },
      "parent": {
        "dbId": "33554524",
        "displayName": "string",
        "entityDefName": "Project",
        "viewURL": "string"
      }
    }
  ],
  "viewURL": "string"
}
`