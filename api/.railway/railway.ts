import { defineRailway, github, project, service } from "railway/iac";
// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "VeloClub";
export default defineRailway(() => {
  const VeloClub = service("VeloClub", {
    source: github("NexCode97-Tech/VeloClub", { branch: "main", checkSuites: false, rootDirectory: "api" }),
    preDeploy: "npx prisma migrate deploy",
    replicas: { "us-west2": 1 },
    networking: { privateNetworkEndpoint: "veloclub" },
  });

  return project("App VeloClub", {
    variables: { managed: false },
    resources: [VeloClub],
  });
});
