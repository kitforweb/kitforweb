import { exposeWorker } from "@/lib/worker-rpc";
import { optimizeSvg, type SvgOptimizeRequest } from "@/lib/utils/image/svg-optimize";

exposeWorker((req: SvgOptimizeRequest) => optimizeSvg(req));
