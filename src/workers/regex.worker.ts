import { exposeWorker } from "@/lib/worker-rpc";
import { runRegexTest, type TestRequest } from "@/lib/utils/regex/tester";

exposeWorker((req: TestRequest) => runRegexTest(req));
