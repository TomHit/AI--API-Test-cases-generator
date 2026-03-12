export const mockOrg = {
  name: "XauTrendLab",
  teams: 3,
  projects: 4,
  apis: 107,
  tests: 1240,
};

export const mockTeams = [
  { id: "t1", name: "QA Team", members: 5, projects: 3 },
  { id: "t2", name: "Backend Team", members: 4, projects: 2 },
  { id: "t3", name: "Security Team", members: 2, projects: 1 },
];

export const mockProjects = [
  {
    id: "p1",
    name: "Trading API",
    teams: ["QA Team", "Backend Team"],
    apis: 32,
    tests: 180,
  },
  { id: "p2", name: "Auth API", teams: ["Security Team"], apis: 14, tests: 96 },
  { id: "p3", name: "Orders API", teams: ["QA Team"], apis: 21, tests: 124 },
];
