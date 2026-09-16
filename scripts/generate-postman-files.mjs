import fs from 'fs';

const collection = {
  info: {
    name: "CampusFlow REST API v1 Test Suite",
    _postman_id: "cf-api-postman-suite-2026",
    description: "Comprehensive Postman Collection covering Authentication, Campus Spatial Data, Personal Timetable, Indoor Navigation, Queues, Office Ticketing, AI Assistant, and Admin Analytics.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  variable: [
    { key: "base_url", value: "http://localhost:8001/api/v1", type: "string" },
    { key: "student_token", value: "", type: "string" },
    { key: "admin_token", value: "", type: "string" }
  ],
  item: [
    {
      name: "01 - System & Health",
      item: [
        {
          name: "API Health Check",
          request: {
            method: "GET",
            header: [],
            url: { raw: "{{base_url}}/health", host: ["{{base_url}}"], path: ["health"] }
          },
          event: [{
            listen: "test",
            script: {
              exec: [
                "pm.test('Status code is 200 OK', function () { pm.response.to.have.status(200); });",
                "pm.test('Response time < 200ms', function () { pm.expect(pm.response.responseTime).to.be.below(200); });",
                "pm.test('Database latency reported', function () { var jsonData = pm.response.json(); pm.expect(jsonData.data.database.latency_ms).to.be.a('number'); });"
              ],
              type: "text/javascript"
            }
          }]
        },
        {
          name: "Public Campus Overview",
          request: {
            method: "GET",
            header: [],
            url: { raw: "{{base_url}}/public/overview", host: ["{{base_url}}"], path: ["public", "overview"] }
          },
          event: [{
            listen: "test",
            script: {
              exec: [
                "pm.test('Status code is 200 OK', function () { pm.response.to.have.status(200); });",
                "pm.test('Stats object returned', function () { var data = pm.response.json(); pm.expect(data.data.stats.buildings).to.be.above(0); });"
              ],
              type: "text/javascript"
            }
          }]
        }
      ]
    },
    {
      name: "02 - Auth & Identity",
      item: [
        {
          name: "Student Account Login",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({ email: "student@campusflow.dev", password: "CampusFlow2026!" }, null, 2)
            },
            url: { raw: "{{base_url}}/auth/login", host: ["{{base_url}}"], path: ["auth", "login"] }
          },
          event: [{
            listen: "test",
            script: {
              exec: [
                "pm.test('Status code is 200 OK', function () { pm.response.to.have.status(200); });",
                "var jsonData = pm.response.json();",
                "pm.test('JWT token issued', function () { pm.expect(jsonData.data.token).to.be.a('string'); });",
                "pm.environment.set('student_token', jsonData.data.token);"
              ],
              type: "text/javascript"
            }
          }]
        },
        {
          name: "Administrator Login",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({ email: "admin@campusflow.dev", password: "CampusFlow2026!" }, null, 2)
            },
            url: { raw: "{{base_url}}/auth/login", host: ["{{base_url}}"], path: ["auth", "login"] }
          },
          event: [{
            listen: "test",
            script: {
              exec: [
                "pm.test('Status code is 200 OK', function () { pm.response.to.have.status(200); });",
                "var jsonData = pm.response.json();",
                "pm.environment.set('admin_token', jsonData.data.token);"
              ],
              type: "text/javascript"
            }
          }]
        },
        {
          name: "Get Authenticated User Profile",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{student_token}}" }],
            url: { raw: "{{base_url}}/auth/me", host: ["{{base_url}}"], path: ["auth", "me"] }
          },
          event: [{
            listen: "test",
            script: {
              exec: [
                "pm.test('Status code is 200 OK', function () { pm.response.to.have.status(200); });",
                "pm.test('Email matches student', function () { pm.expect(pm.response.json().data.user.email).to.eql('student@campusflow.dev'); });"
              ],
              type: "text/javascript"
            }
          }]
        }
      ]
    },
    {
      name: "03 - Campus & Spatial Data",
      item: [
        {
          name: "List Buildings",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{student_token}}" }],
            url: { raw: "{{base_url}}/buildings", host: ["{{base_url}}"], path: ["buildings"] }
          }
        },
        {
          name: "Search Rooms",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{student_token}}" }],
            url: { raw: "{{base_url}}/rooms?min_capacity=20", host: ["{{base_url}}"], path: ["rooms"], query: [{ key: "min_capacity", value: "20" }] }
          }
        }
      ]
    },
    {
      name: "04 - Student Services & Timetable",
      item: [
        {
          name: "Get Personal Timetable",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{student_token}}" }],
            url: { raw: "{{base_url}}/me/timetable", host: ["{{base_url}}"], path: ["me", "timetable"] }
          }
        }
      ]
    },
    {
      name: "05 - Positioning & Navigation",
      item: [
        {
          name: "Calculate A* Navigation Route",
          request: {
            method: "POST",
            header: [
              { key: "Authorization", value: "Bearer {{student_token}}" },
              { key: "Content-Type", value: "application/json" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({ from_node_id: "a5f08dea-64ad-46dc-8986-582599a29a50", to_room_code: "A101", accessible: false }, null, 2)
            },
            url: { raw: "{{base_url}}/navigation/route", host: ["{{base_url}}"], path: ["navigation", "route"] }
          }
        }
      ]
    },
    {
      name: "06 - Admission Queues & Offices",
      item: [
        {
          name: "List Active Room Queues",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{student_token}}" }],
            url: { raw: "{{base_url}}/queues", host: ["{{base_url}}"], path: ["queues"] }
          }
        },
        {
          name: "List Admin Offices",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{student_token}}" }],
            url: { raw: "{{base_url}}/offices", host: ["{{base_url}}"], path: ["offices"] }
          }
        }
      ]
    },
    {
      name: "07 - AI Assistant & Engagement",
      item: [
        {
          name: "AI Campus Assistant Chat",
          request: {
            method: "POST",
            header: [
              { key: "Authorization", value: "Bearer {{student_token}}" },
              { key: "Content-Type", value: "application/json" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({ message: "Where is Halden Hall?" }, null, 2)
            },
            url: { raw: "{{base_url}}/ai/messages", host: ["{{base_url}}"], path: ["ai", "messages"] }
          }
        },
        {
          name: "List Campus Events",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{student_token}}" }],
            url: { raw: "{{base_url}}/events", host: ["{{base_url}}"], path: ["events"] }
          }
        }
      ]
    },
    {
      name: "08 - Admin & Analytics",
      item: [
        {
          name: "Admin Analytics Dashboard",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{admin_token}}" }],
            url: { raw: "{{base_url}}/admin/analytics", host: ["{{base_url}}"], path: ["admin", "analytics"] }
          }
        }
      ]
    }
  ]
};

const environment = {
  id: "campusflow-local-env",
  name: "CampusFlow Local Development Environment",
  values: [
    { key: "base_url", value: "http://localhost:8001/api/v1", enabled: true },
    { key: "student_token", value: "", enabled: true },
    { key: "admin_token", value: "", enabled: true }
  ],
  _postman_variable_scope: "environment"
};

fs.writeFileSync('/home/user/CampusFlow/docs/CampusFlow.postman_collection.json', JSON.stringify(collection, null, 2));
fs.writeFileSync('/home/user/CampusFlow/docs/CampusFlow.postman_environment.json', JSON.stringify(environment, null, 2));
console.log('✅ Generated CampusFlow.postman_collection.json and CampusFlow.postman_environment.json in docs/');
