import { Schema, model } from "mongoose";

const organizationDataSchema = new Schema(
  {
    name: { type: String, required: true },
    login: { type: String, required: true },
    description: { type: String, default: null },
    website: { type: String, default: null },
    location: { type: String, default: null },
    email: { type: String, default: null },
    avatarUrl: { type: String, default: null },
    stats: {
      repositories: { type: Number, default: null },
      people: { type: Number, default: null },
    },
    pinnedRepos: [
      {
        name: { type: String, required: true },
        description: { type: String, default: null },
        stars: { type: Number, default: 0 },
        forks: { type: Number, default: 0 },
        language: { type: String, default: null },
      },
    ],
  },
  { _id: false },
);

const metadataSchema = new Schema(
  {
    sourceUrl: { type: String, required: true },
    responseTimeMs: { type: Number, required: true },
    proxyUsed: { type: String, default: null },
    fetchedAt: { type: String, required: true },
    peopleCountSource: { type: String, default: null },
    repositoriesCountSource: { type: String, default: null },
  },
  { _id: false },
);

const crawlerResultMongooseSchema = new Schema(
  {
    requestId: { type: String, required: true, unique: true, index: true },
    organizationName: { type: String, required: true },
    data: { type: organizationDataSchema, required: true },
    metadata: { type: metadataSchema, required: true },
  },
  {
    timestamps: true,
    collection: "ghorg_organization_profiles",
  },
);

export const CrawlerResultModel = model(
  "GhorgOrganizationProfile",
  crawlerResultMongooseSchema,
);
