#!/usr/bin/env node
const parseArgsAndExecute = require('../lib')

const dir = process.cwd()
parseArgsAndExecute(dir, process.argv.slice(2))
