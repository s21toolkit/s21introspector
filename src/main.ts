#!/usr/bin/env node

import { binary, run } from "cmd-ts"
import { cli } from "@/cli"

run(binary(cli), process.argv)
