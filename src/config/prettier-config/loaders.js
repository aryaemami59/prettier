import { pathToFileURL } from "node:url";

import parseToml from "@iarna/toml/parse-async.js";
import { load as parseYaml } from "js-yaml";
import json5 from "json5";
import parseJson from "parse-json";

import readFile from "../../utils/read-file.js";

async function readJson(file) {
  const content = await readFile(file);
  try {
    return parseJson(content);
  } catch (/** @type {any} */ error) {
    error.message = `JSON Error in ${file}:\n${error.message}`;
    throw error;
  }
}

async function loadJs(file) {
  const module = await import(pathToFileURL(file).href);
  return module.default;
}

function isRunningInBun() {
  return Boolean(globalThis.Bun) || Boolean(globalThis.process?.versions?.bun);
}

function isRunningInDeno() {
  return Boolean(globalThis.Deno);
}

const isBun = isRunningInBun();

const isDeno = isRunningInDeno();

async function loadTs(file) {
  if (isBun || isDeno) {
    return await loadJs(file);
  }

  const { tsImport } = await import("tsx/esm/api").then(
    (tsx) => tsx,
    (error) => {
      if (
        error.code === "ERR_MODULE_NOT_FOUND" &&
        error.message.startsWith("Cannot find package")
      ) {
        throw new Error(
          'To load TypeScript config files, you need to install the "tsx" package: \nnpm -D install tsx\nyarn add -D tsx\npnpm add -D tsx\nbun add -D tsx',
        );
      }

      throw error;
    },
  );

  const module = await tsImport(pathToFileURL(file).href, {
    parentURL: import.meta.url,
    tsconfig: false,
  });

  return (await module?.default) ?? module;
}

async function loadConfigFromPackageJson(file) {
  const { prettier } = await readJson(file);
  return prettier;
}

async function loadConfigFromPackageYaml(file) {
  const { prettier } = await loadYaml(file);
  return prettier;
}

async function loadYaml(file) {
  const content = await readFile(file);
  try {
    return parseYaml(content);
  } catch (/** @type {any} */ error) {
    error.message = `YAML Error in ${file}:\n${error.message}`;
    throw error;
  }
}

const loaders = {
  async ".toml"(file) {
    const content = await readFile(file);
    try {
      return await parseToml(content);
    } catch (/** @type {any} */ error) {
      error.message = `TOML Error in ${file}:\n${error.message}`;
      throw error;
    }
  },
  async ".json5"(file) {
    const content = await readFile(file);
    try {
      return json5.parse(content);
    } catch (/** @type {any} */ error) {
      error.message = `JSON5 Error in ${file}:\n${error.message}`;
      throw error;
    }
  },
  ".json": readJson,
  ".js": loadJs,
  ".mjs": loadJs,
  ".cjs": loadJs,
  ".ts": loadTs,
  ".mts": loadTs,
  ".cts": loadTs,
  ".yaml": loadYaml,
  ".yml": loadYaml,
  // No extension
  "": loadYaml,
};

export default loaders;
export { loadConfigFromPackageJson, loadConfigFromPackageYaml, readJson };
