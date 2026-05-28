// Pre-configured axios instance with /api as the base URL, used by all frontend API calls.

import axios from "axios";

const client = axios.create({ baseURL: "/api" });
export default client;
