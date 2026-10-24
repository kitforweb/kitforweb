import { exposeWorker } from "@/lib/worker-rpc";
import { computeDiff, type DiffRequest } from "@/lib/utils/text/diff";

exposeWorker((req: DiffRequest) => computeDiff(req));
