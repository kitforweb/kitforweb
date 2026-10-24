import type { ToolId } from "@/config/tools";
import base64 from "./base64.json";
import bcrypt from "./bcrypt.json";
import boxShadow from "./box-shadow.json";
import caseConverter from "./case-converter.json";
import chmod from "./chmod.json";
import cidr from "./cidr.json";
import colorConverter from "./color-converter.json";
import colorScale from "./color-scale.json";
import contrast from "./contrast.json";
import cron from "./cron.json";
import cssClamp from "./css-clamp.json";
import cubicBezier from "./cubic-bezier.json";
import curlToFetch from "./curl-to-fetch.json";
import dateDiff from "./date-diff.json";
import dockerCompose from "./docker-compose.json";
import envJson from "./env-json.json";
import favicon from "./favicon.json";
import gradient from "./gradient.json";
import gzip from "./gzip.json";
import hash from "./hash.json";
import hmac from "./hmac.json";
import htmlEntities from "./html-entities.json";
import htmlToJsx from "./html-to-jsx.json";
import httpHeaders from "./http-headers.json";
import httpStatus from "./http-status.json";
import jsonCsv from "./json-csv.json";
import jsonDiff from "./json-diff.json";
import jsonFormat from "./json-format.json";
import jsonMock from "./json-mock.json";
import jsonSchema from "./json-schema.json";
import jsonToTs from "./json-to-ts.json";
import jsonToZod from "./json-to-zod.json";
import jsonYaml from "./json-yaml.json";
import jwtDecoder from "./jwt-decoder.json";
import jwtGenerator from "./jwt-generator.json";
import keyboard from "./keyboard.json";
import keypair from "./keypair.json";
import markdown from "./markdown.json";
import mermaid from "./mermaid.json";
import metaTags from "./meta-tags.json";
import numberBase from "./number-base.json";
import openapiViewer from "./openapi-viewer.json";
import passwordGenerator from "./password-generator.json";
import playground from "./playground.json";
import punycode from "./punycode.json";
import pxRem from "./px-rem.json";
import qr from "./qr.json";
import regexBuilder from "./regex-builder.json";
import regexLibrary from "./regex-library.json";
import regexTester from "./regex-tester.json";
import semver from "./semver.json";
import sqlEr from "./sql-er.json";
import sqlFormatter from "./sql-formatter.json";
import svgOptimize from "./svg-optimize.json";
import svgToReact from "./svg-to-react.json";
import textDiff from "./text-diff.json";
import timestamp from "./timestamp.json";
import timezones from "./timezones.json";
import typeScale from "./type-scale.json";
import unicode from "./unicode.json";
import urlEncode from "./url-encode.json";
import urlParams from "./url-params.json";
import userAgent from "./user-agent.json";
import uuid from "./uuid.json";
import webp from "./webp.json";
import x509 from "./x509.json";
import xmlFormat from "./xml-format.json";
import xmlJson from "./xml-json.json";

/**
 * One file per tool with its strings in every language. `en` and `es` are
 * complete; `fr` and `pt` must at least translate the SEO keys (name, short,
 * title, description, h1, lead) and fall back to English for the rest.
 *
 * Generated from the registry order: keep one import per tool.
 */
export const toolMessageFiles: Record<ToolId, object> = {
  "json-format": jsonFormat,
  "json-to-ts": jsonToTs,
  "json-to-zod": jsonToZod,
  "json-mock": jsonMock,
  "json-diff": jsonDiff,
  "json-yaml": jsonYaml,
  "json-csv": jsonCsv,
  "jwt-decoder": jwtDecoder,
  "jwt-generator": jwtGenerator,
  "url-params": urlParams,
  base64: base64,
  "url-encode": urlEncode,
  "html-entities": htmlEntities,
  unicode,
  "number-base": numberBase,
  punycode,
  gzip,
  hash,
  hmac,
  uuid,
  bcrypt,
  "password-generator": passwordGenerator,
  keypair,
  x509: x509,
  "regex-builder": regexBuilder,
  "regex-tester": regexTester,
  "regex-library": regexLibrary,
  timestamp,
  timezones,
  "date-diff": dateDiff,
  cron,
  "curl-to-fetch": curlToFetch,
  "http-status": httpStatus,
  "http-headers": httpHeaders,
  "meta-tags": metaTags,
  "user-agent": userAgent,
  semver,
  "sql-formatter": sqlFormatter,
  "sql-er": sqlEr,
  "openapi-viewer": openapiViewer,
  "json-schema": jsonSchema,
  "xml-json": xmlJson,
  "xml-format": xmlFormat,
  "docker-compose": dockerCompose,
  cidr,
  chmod,
  "env-json": envJson,
  markdown,
  "html-to-jsx": htmlToJsx,
  "case-converter": caseConverter,
  "text-diff": textDiff,
  keyboard,
  "css-clamp": cssClamp,
  "type-scale": typeScale,
  "color-converter": colorConverter,
  "color-scale": colorScale,
  contrast,
  "box-shadow": boxShadow,
  gradient,
  "cubic-bezier": cubicBezier,
  "px-rem": pxRem,
  "svg-optimize": svgOptimize,
  "svg-to-react": svgToReact,
  favicon,
  webp,
  qr,
  mermaid,
  playground,
};
