#!/usr/bin/env node
const { ArgumentParser } = require('argparse')
const { spawn } = require('child_process')
require('fresh-console')
const { readFile, writeFile } = require('fs').promises
const { prompt } = require('inquirer')
const path = require('path')
const slugify = require('slugify')
const packageInfo = require('./package.json')

const parser = new ArgumentParser({ add_help: true, description: packageInfo.description })
parser.add_argument('-v', '--version', { action: 'version' })
parser.add_argument('--app-name', { help: 'Application name' })
parser.add_argument('--package-name', { help: 'Package name' })
parser.add_argument('--package-author', { help: 'Package author' })
parser.add_argument('--package-version', { help: 'Package version' })
parser.add_argument('--package-description', { help: 'Package description' })
parser.add_argument('--package-license', { help: 'Package license' })
parser.add_argument('--package-url', { help: 'Package repository URL' })

parser.add_argument('--dry-run', { help: 'Run script but make no file system changes', action: 'store_true' })
const args = parser.parse_args()

async function exec(...args) {
    const proc = spawn(...args)
    await new Promise(res => proc.on('close', res))
}

async function run() {
    console.info('----- Generate Front-End Starter! ------')
    const appName = args.app_name || (await prompt([{ name: 'appName', message: 'Name of app:', validate: val => val !== '' }])).appName
    const packageName = args.package_name || (await prompt([{ name: 'packageName', message: 'Package name:', default: slugify(appName.toLowerCase(), { strict: true }) }])).packageName
    const author = args.package_author || (await prompt([{ name: 'author', message: 'Author:' }])).author
    const description = args.package_description || (await prompt([{ name: 'description', message: 'Description:' }])).description
    const version = args.package_version || (await prompt([{ name: 'version', message: 'Initial version:', default: '0.1.0', validate: v => v.match(/[0-9]+\.[0-9]+\.[0-9]+/) !== null }])).version
    const license = args.package_license || (await prompt([{ name: 'license', message: 'License:', default: 'MIT' }])).license
    const repoURL = args.package_url || (await prompt([{ name: 'repository', message: 'Repository URL' }])).repository
    // Clone repo
    console.info(`Cloning into ${packageName}...`)
    await exec('git', ['clone', 'https://github.com/foxxyz/front-end-starter.git', packageName])

    console.info('Removing git remote...')
    await exec('git', ['remote', 'remove', 'origin'])

    console.info('Removing CI directory...')
    await exec('rm', ['-rf', path.join(packageName, '.github')])

    console.info('Removing package-lock.json...')
    await exec('rm', [path.join(packageName, 'package-lock.json')])

    console.info('Updating package.json...')
    const packageFile = path.join(packageName, 'package.json')
    let packageJson = await readFile(packageFile, { encoding: 'utf8' })
    packageJson = packageJson.replace(/"name": "[^"]+"/, `"name": "${packageName}"`)
    packageJson = packageJson.replace(/"version": "[^"]+"/, `"version": "${version}"`)
    packageJson = packageJson.replace(/"description": "[^"]+"/, `"description": "${description}"`)
    packageJson = packageJson.replace(/"author": "[^"]+"/, `"author": "${author}"`)
    packageJson = packageJson.replace(/"license": "[^"]+"/, `"license": "${license}"`)
    packageJson = packageJson.replace(/"url": "[^"]+"/, `"url": "${repoURL}"`)
    await writeFile(packageFile, packageJson)

    console.info('Updating index.html...')
    const indexFile = path.join(packageName, 'index.html')
    let index = await readFile(indexFile, { encoding: 'utf8' })
    index = index.replace(/<title>[^<]+<\/title>/, `<title>${appName}</title>`)
    await writeFile(indexFile, index)

    console.info('Updating README.md...')
    const readmeFile = path.join(packageName, 'README.md')
    let readme = await readFile(readmeFile, { encoding: 'utf8' })
    // Set title
    readme = readme.replace(/.*(\s)+(=+)/m, `${appName}$1${'='.repeat(appName.length)}`)
    // Update installation instructions
    readme = readme.replace(/git clone [^`]+/, `git clone ${repoURL}`)
    // Update usage block
    readme = readme.replace(/(?:Usage\s+-+\s+)([\s\S]+)(?:Deployment)/, 'peepohappy')

    await writeFile(readmeFile, readme)
}

run()