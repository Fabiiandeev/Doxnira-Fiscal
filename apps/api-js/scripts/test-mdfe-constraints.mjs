import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config } from 'dotenv';
import pg from 'pg';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(scriptDirectory, '..', '.env.test') });

const results = { positive: false, approved: [], failed: [], rollback: false, residual: 'not checked' };
let client;
let transactionOpen = false;
let runPrefix;
let savepointIndex = 0;

function fail(message) {
  throw new Error(message);
}

async function expectConstraint(name, constraint, statement, values) {
  const savepoint = `mdfe_constraint_${++savepointIndex}`;
  await client.query(`SAVEPOINT ${savepoint}`);
  try {
    await client.query(statement, values);
    results.failed.push(`${name}: nenhum erro retornado (esperada ${constraint})`);
  } catch (error) {
    if (error.constraint === constraint) {
      results.approved.push(name);
    } else {
      results.failed.push(`${name}: esperada ${constraint}; recebida ${error.constraint ?? error.code ?? error.message}`);
    }
  } finally {
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    await client.query(`RELEASE SAVEPOINT ${savepoint}`);
  }
}

function draftValues(overrides = {}) {
  return {
    id: randomUUID(),
    companyId: fixture.companyId,
    model: '58',
    issuerType: 'PRESTADOR_SERVICO_TRANSPORTE',
    carrierType: 'TRANSPORTADOR',
    createdById: fixture.userId,
    ...overrides,
  };
}

async function insertDraft(overrides = {}) {
  const value = draftValues(overrides);
  return client.query(
    `INSERT INTO public.mdfe_drafts
      (id, company_id, model, issuer_type, carrier_type, created_by_id, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
    [value.id, value.companyId, value.model, value.issuerType, value.carrierType, value.createdById],
  );
}

const fixture = {};

async function createFixtures() {
  fixture.userId = randomUUID();
  fixture.companyId = randomUUID();
  fixture.fiscalDocumentId = randomUUID();
  fixture.nfeEntryId = randomUUID();
  fixture.cteEntryId = randomUUID();
  fixture.draftId = randomUUID();
  fixture.nfeKey = '1'.repeat(44);
  fixture.cteKey = '2'.repeat(44);

  await client.query(
    `INSERT INTO public.users (id, name, email, password_hash, updated_at)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
    [fixture.userId, 'MDF-e Constraint Test', `${runPrefix}@example.test`, 'not-used-by-test'],
  );
  await client.query(
    `INSERT INTO public.companies (id, owner_id, legal_name, cnpj, environment, updated_at)
     VALUES ($1, $2, $3, $4, 'homologation', CURRENT_TIMESTAMP)`,
    [fixture.companyId, fixture.userId, 'MDF-e Constraint Test Company', runPrefix.replace(/\D/g, '').padStart(14, '0').slice(-14)],
  );
  await client.query(
    `INSERT INTO public.fiscal_documents
      (id, company_id, document_type, access_key, xml_storage_key, xml_hash_sha256, updated_at)
     VALUES ($1, $2, 'NFE', $3, $4, $5, CURRENT_TIMESTAMP)`,
    [fixture.fiscalDocumentId, fixture.companyId, fixture.nfeKey, `test/${runPrefix}.xml`, 'a'.repeat(64)],
  );
  await client.query(
    `INSERT INTO public.nfe_entries (id, company_id, fiscal_document_id, access_key, updated_at)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
    [fixture.nfeEntryId, fixture.companyId, fixture.fiscalDocumentId, fixture.nfeKey],
  );
  await client.query(
    `INSERT INTO public.cte_entries (id, company_id, access_key, updated_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
    [fixture.cteEntryId, fixture.companyId, fixture.cteKey],
  );
}

const linkSql = `INSERT INTO public.mdfe_fiscal_document_links
  (id, company_id, mdfe_draft_id, document_type, nfe_entry_id, cte_entry_id, access_key, sequence, updated_at)
 VALUES ($1, $2, $3, $4::"MdfeDocumentType", $5, $6, $7, $8, CURRENT_TIMESTAMP)`;

async function run() {
  const databaseUrl = process.env.DATABASE_URL_TEST;
  if (!databaseUrl) fail('DATABASE_URL_TEST é obrigatório.');
  const parsedUrl = new URL(databaseUrl);
  const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ''));
  if (!/(test|testing|ci)/i.test(databaseName)) fail(`Banco bloqueado: ${databaseName}`);

  client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  const databaseCheck = await client.query('SELECT current_database() AS database, current_schema() AS schema');
  const { database, schema } = databaseCheck.rows[0];
  if (database !== 'ns_fiscal_cloud_test') fail(`Banco inesperado: ${database}`);
  if (schema !== 'public') fail(`Schema inesperado: ${schema}`);

  runPrefix = `mdfe-constraints-${randomUUID()}`;
  await client.query('BEGIN');
  transactionOpen = true;
  await createFixtures();

  await insertDraft({ id: fixture.draftId });
  await client.query(
    `INSERT INTO public.mdfe_route_states (id, company_id, mdfe_draft_id, state_code, sequence, updated_at)
     VALUES ($1, $2, $3, 'SP', 1, CURRENT_TIMESTAMP)`,
    [randomUUID(), fixture.companyId, fixture.draftId],
  );
  await client.query(linkSql, [randomUUID(), fixture.companyId, fixture.draftId, 'NFE', fixture.nfeEntryId, null, fixture.nfeKey, 1]);
  await client.query(linkSql, [randomUUID(), fixture.companyId, fixture.draftId, 'CTE', null, fixture.cteEntryId, fixture.cteKey, 2]);
  await client.query(
    `INSERT INTO public.mdfe_validation_runs
      (id, company_id, mdfe_draft_id, version, status, is_valid, blocking_issues_count, warning_issues_count)
     VALUES ($1, $2, $3, 1, 'COMPLETED', true, 0, 0)`,
    [randomUUID(), fixture.companyId, fixture.draftId],
  );
  results.positive = true;

  await expectConstraint('modelo diferente de 58', 'mdfe_drafts_model_58_check',
    `INSERT INTO public.mdfe_drafts (id, company_id, model, issuer_type, carrier_type, created_by_id, updated_at) VALUES ($1,$2,'57',$3,$4,$5,CURRENT_TIMESTAMP)`,
    [randomUUID(), fixture.companyId, 'PRESTADOR_SERVICO_TRANSPORTE', 'TRANSPORTADOR', fixture.userId]);
  await expectConstraint('version = 0', 'mdfe_drafts_version_positive_check',
    `INSERT INTO public.mdfe_drafts (id, company_id, issuer_type, carrier_type, created_by_id, version, updated_at) VALUES ($1,$2,$3,$4,$5,0,CURRENT_TIMESTAMP)`,
    [randomUUID(), fixture.companyId, 'PRESTADOR_SERVICO_TRANSPORTE', 'TRANSPORTADOR', fixture.userId]);
  await expectConstraint('currentStep = 0', 'mdfe_drafts_current_step_positive_check',
    `INSERT INTO public.mdfe_drafts (id, company_id, issuer_type, carrier_type, created_by_id, current_step, updated_at) VALUES ($1,$2,$3,$4,$5,0,CURRENT_TIMESTAMP)`,
    [randomUUID(), fixture.companyId, 'PRESTADOR_SERVICO_TRANSPORTE', 'TRANSPORTADOR', fixture.userId]);
  await expectConstraint('sequence = 0', 'mdfe_route_states_sequence_positive_check',
    `INSERT INTO public.mdfe_route_states (id, company_id, mdfe_draft_id, state_code, sequence, updated_at) VALUES ($1,$2,$3,'SP',0,CURRENT_TIMESTAMP)`,
    [randomUUID(), fixture.companyId, fixture.draftId]);
  await expectConstraint('UF inválida', 'mdfe_route_states_state_code_length_check',
    `INSERT INTO public.mdfe_route_states (id, company_id, mdfe_draft_id, state_code, sequence, updated_at) VALUES ($1,$2,$3,'X',2,CURRENT_TIMESTAMP)`,
    [randomUUID(), fixture.companyId, fixture.draftId]);
  await expectConstraint('valor Decimal negativo', 'mdfe_fiscal_document_links_document_value_nonnegative_check',
    `INSERT INTO public.mdfe_fiscal_document_links (id, company_id, mdfe_draft_id, document_type, nfe_entry_id, access_key, document_value, sequence, updated_at) VALUES ($1,$2,$3,'NFE',$4,$5,-0.01,3,CURRENT_TIMESTAMP)`,
    [randomUUID(), fixture.companyId, fixture.draftId, fixture.nfeEntryId, fixture.nfeKey]);
  await expectConstraint('vínculo sem NF-e/CT-e', 'mdfe_fiscal_document_links_exactly_one_source_check', linkSql,
    [randomUUID(), fixture.companyId, fixture.draftId, 'NFE', null, null, '3'.repeat(44), 3]);
  await expectConstraint('vínculo com NF-e e CT-e', 'mdfe_fiscal_document_links_exactly_one_source_check', linkSql,
    [randomUUID(), fixture.companyId, fixture.draftId, 'NFE', fixture.nfeEntryId, fixture.cteEntryId, '4'.repeat(44), 3]);
  await expectConstraint('tipo NFE com cteEntryId', 'mdfe_fiscal_document_links_document_type_source_check', linkSql,
    [randomUUID(), fixture.companyId, fixture.draftId, 'NFE', null, fixture.cteEntryId, '5'.repeat(44), 3]);
  await expectConstraint('tipo CTE com nfeEntryId', 'mdfe_fiscal_document_links_document_type_source_check', linkSql,
    [randomUUID(), fixture.companyId, fixture.draftId, 'CTE', fixture.nfeEntryId, null, '6'.repeat(44), 3]);
  await expectConstraint('blocking issues negativos', 'mdfe_validation_runs_blocking_issues_nonnegative_check',
    `INSERT INTO public.mdfe_validation_runs (id, company_id, mdfe_draft_id, version, status, is_valid, blocking_issues_count, warning_issues_count) VALUES ($1,$2,$3,1,'COMPLETED',false,-1,0)`,
    [randomUUID(), fixture.companyId, fixture.draftId]);
  await expectConstraint('warning issues negativos', 'mdfe_validation_runs_warning_issues_nonnegative_check',
    `INSERT INTO public.mdfe_validation_runs (id, company_id, mdfe_draft_id, version, status, is_valid, blocking_issues_count, warning_issues_count) VALUES ($1,$2,$3,1,'COMPLETED',false,0,-1)`,
    [randomUUID(), fixture.companyId, fixture.draftId]);

  if (results.failed.length) fail(`Falhas: ${results.failed.join(' | ')}`);
} 

let completeError;
try {
  await run();
} catch (error) {
  completeError = error;
  results.failed.push(error.stack || error.message);
} finally {
  if (transactionOpen) {
    try {
      await client.query('ROLLBACK');
      results.rollback = true;
    } catch (error) {
      results.failed.push(`ROLLBACK: ${error.stack || error.message}`);
    }
  }
  if (client) await client.end();
}

console.log(JSON.stringify({ ...results, error: completeError?.stack || null }, null, 2));
process.exitCode = completeError || results.failed.length ? 1 : 0;
