#!/usr/bin/env node

import { cli } from "@/cli"
import { binary, run } from "cmd-ts"

run(binary(cli), process.argv)
