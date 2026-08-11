import * as service from "./marketing.service.js";

export async function getPlans(_request, response) { response.json({ plans: await service.getPublicPlans() }); }
export async function getFeatures(_request, response) { response.json({ features: await service.getPublicFeatures() }); }
export async function getStatus(request, response) { response.json({ status: "ok", services: { api: { status: "ok" } }, requestId: request.id }); }
export async function postLead(request, response) { const lead = await service.createLead(request.body, request); response.status(201).json({ id: lead.id, status: lead.status, requestId: request.id }); }
export async function postContact(request, response) { const lead = await service.createContact(request.body, request); response.status(201).json({ id: lead.id, status: lead.status, requestId: request.id }); }
