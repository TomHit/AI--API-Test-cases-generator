import fs from "fs/promises";
import path from "path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
  allowUnionTypes: true,
});

addFormats(ajv);

let validateFn = null;

async function loadJson(filePath) {
  let raw;
  try {
    raw = await fs.readFile(filePath, "utf-8");
  } catch (e) {
    const err = new Error(`Unable to read schema file at: ${filePath}`);
    err.details = { schemaPath: filePath, cause: String(e?.message || e) };
    throw err;
  }

  try {
    return JSON.parse(raw);
  } catch (e) {
    const err = new Error(`Invalid JSON in schema file: ${filePath}`);
    err.details = { schemaPath: filePath, cause: String(e?.message || e) };
    throw err;
  }
}

export async function getValidator() {
  if (validateFn) return validateFn;

  const schemaDir = path.join(process.cwd(), "src", "schema");

  const testCaseSchemaPath = path.join(schemaDir, "test_case.schema.json");
  const testPlanSchemaPath = path.join(schemaDir, "test_plan.schema.json");

  const testCaseSchema = await loadJson(testCaseSchemaPath);
  const testPlanSchema = await loadJson(testPlanSchemaPath);

  ajv.addSchema(
    testCaseSchema,
    testCaseSchema.$id || "./test_case.schema.json",
  );
  ajv.addSchema(testCaseSchema, "./test_case.schema.json");

  validateFn = ajv.compile(testPlanSchema);
  return validateFn;
}

export async function validateTestPlanOrThrow(obj) {
  const validate = await getValidator();
  const ok = validate(obj);

  if (!ok) {
    const errors = (validate.errors || []).map((e) => ({
      path: e.instancePath || "/",
      message: e.message,
      keyword: e.keyword,
      params: e.params,
      schemaPath: e.schemaPath,
    }));

    console.log("AJV ERRORS:", JSON.stringify(errors, null, 2));

    const err = new Error("Schema validation failed");
    err.details = { errors };
    throw err;
  }

  return true;
}
