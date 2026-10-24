import { exposeWorker } from "@/lib/worker-rpc";
import { jsonToTypes, type QuicktypeRequest } from "@/lib/utils/json/quicktype";

exposeWorker((req: QuicktypeRequest) => jsonToTypes(req));
