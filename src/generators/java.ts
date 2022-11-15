import * as util from "../util.js";
import type { Request, Warnings } from "../util.js";

import jsesc from "jsesc";

const supportedArgs = new Set([
  "url",
  "request",
  "user-agent",
  "cookie",
  "data",
  "data-raw",
  "data-ascii",
  "data-binary",
  "data-urlencode",
  "json",
  "referer",
  // TODO
  // "form",
  // "form-string",
  "get",
  "header",
  "head",
  "no-head",
  "user",
]);

const doubleQuotes = (str: string): string => jsesc(str, { quotes: "double" });

export const _toJava = (request: Request, warnings: Warnings = []): string => {
  let javaCode = '//seed:{"crawl_link":"' + request.url + '"}\n';
  //Header:
  javaCode += "    def getHeader() {";
  javaCode +=
      "\n        Map<String, String> header = new HashMap<String, String>();\n";

  let gzip = false;
  if (request.headers) {
    for (const [headerName, headerValue] of request.headers) {
      if (headerValue === null) {
        continue;
      }
      javaCode +=
          '        header.put("' +
          headerName +
          '", "' +
          doubleQuotes(headerValue) +
          '");\n';
      if (headerName.toLowerCase() === "accept-encoding" && headerValue) {
        gzip = headerValue.indexOf("gzip") !== -1;
      }
    }
    javaCode += "\n        return header;\n}\n";
  }

  //seed:
  javaCode += `    /**
     * 种子格式：
     *{"crawl_link":"https://xxxxx"}  ss
     */
    @SeedProcessor
    Request seedProcess(String seed) {
            JSONObject jsonObject = JSONObject.parse(seed)
            String url  = jsonObject.get('crawl_link')
  `;
  javaCode +=
      "        Request request = new Request(url, HttpRequestMethod." +
      request.method.toLowerCase() +
      ", null, getHeader());\n";
  javaCode += "        Map<String, String> map = new HashMap<>();\n";
  javaCode += '        map.put("pageLevel", "seedProcess");\n';
  javaCode += '        map.put("seed", seed);\n';
  javaCode += "        request.setUrlContext(map);\n";
  javaCode += "//        request.setUrlContext(map); 开启浏览器模式\n";
  javaCode += "        return request;\n";
  javaCode += "    }\n";

  //parse
  javaCode += "    @Override\n";
  javaCode += `    Result parse(Page page) {
          if (page.getPageEncode() == null) {
            page.pageEncode = "utf-8";
        }
        Result result = new Result();
        Map<String, String> extraMap = page?.request?.urlContext;

        String pageLevel = extraMap.get("pageLevel");
                if (pageLevel == null) {
            pageLevel = "seedProcess";
        }

        switch (pageLevel) {
        // 解析列表
            case "seedProcess":
                getRaw(page, result, extraMap);
                break;
                }
        return result;
    }\n
        `;

  // if (request.auth) {
  //   javaCode +=
  //     '\t\tbyte[] message = ("' +
  //     doubleQuotes(request.auth.join(":")) +
  //     '").getBytes("UTF-8");\n';
  //   javaCode +=
  //     "\t\tString basicAuth = DatatypeConverter.printBase64Binary(message);\n";
  //   javaCode +=
  //     '\t\thttpConn.setRequestProperty("Authorization", "Basic " + basicAuth);\n';
  //   javaCode += "\n";
  // }

  // if (request.data) {
  //   request.data = doubleQuotes(request.data);
  //   javaCode += "\t\thttpConn.setDoOutput(true);\n";
  //   javaCode +=
  //     "\t\tOutputStreamWriter writer = new OutputStreamWriter(httpConn.getOutputStream());\n";
  //   javaCode += '\t\twriter.write("' + request.data + '");\n';
  //   javaCode += "\t\twriter.flush();\n";
  //   javaCode += "\t\twriter.close();\n";
  //   javaCode += "\t\thttpConn.getOutputStream().close();\n";
  //   javaCode += "\n";
  // }

  //getRaw
  javaCode += `    def getRaw(Page page, Result result, Map<String, String> extraMap) {
        String page_str = page.rawPage
        String seed=extraMap.get("seed")\n`;
  javaCode += `            Map<String, String> map = new HashMap<>();
            map.put(MyField.seed,extraMap)
            map.put(MyField.rawpage, page_str);
            result.addDataMap(map);
            return
           // map.put("level", level);\n
`;
  javaCode += "\t}\n";
  javaCode += `    @FieldClass
    static class MyField {
        @Field(desc = "原始页面")
        public static String rawpage = "rawpage";
        @Field(desc = "种子")
        public static String seed = "seed";
    }
`;
  return javaCode + "\n";
};
export const toJavaWarn = (
    curlCommand: string | string[],
    warnings: Warnings = []
): [string, Warnings] => {
  const request = util.parseCurlCommand(curlCommand, supportedArgs, warnings);
  const java = _toJava(request, warnings);
  return [java, warnings];
};

export const toJava = (curlCommand: string | string[]): string => {
  return toJavaWarn(curlCommand)[0];
};
