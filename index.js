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
const args = parser.parse_args()

async function exec(...args) {
    const proc = spawn(...args)
    await new Promise(res => proc.on('close', res))
}

async function run() {
    console.info(`----- Front-End Generator v${packageInfo.version}------`)
    const appName = args.app_name || (await prompt([{ name: 'appName', message: 'Name of app:', validate: val => val !== '' }])).appName
    const packageName = args.package_name || (await prompt([{ name: 'packageName', message: 'Package name:', default: slugify(appName.toLowerCase(), { strict: true }) }])).packageName
    const author = args.package_author || (await prompt([{ name: 'author', message: 'Author:' }])).author
    const description = args.package_description || (await prompt([{ name: 'description', message: 'Description:' }])).description
    const version = args.package_version || (await prompt([{ name: 'version', message: 'Initial version:', default: '0.1.0', validate: v => v.match(/[0-9]+\.[0-9]+\.[0-9]+/) !== null }])).version
    const license = args.package_license || (await prompt([{ name: 'license', message: 'License:', default: 'MIT' }])).license
    const repoURL = args.package_url || (await prompt([{ name: 'repository', message: 'Repository URL:' }])).repository

    const appDir = path.join('.', packageName)

    // Clone repo
    console.info(`Cloning into ${appDir}...`)
    await exec('git', ['clone', 'https://github.com/foxxyz/front-end-starter.git', packageName])

    // Remove git remote
    const gitDir = path.join(packageName, '.git')
    console.info('Removing existing git repo info...')
    await exec('rm', ['-rf', gitDir])

    // Remove CI directory
    const CIDir = path.join(packageName, '.github')
    console.info('Removing CI directory...')
    await exec('rm', ['-rf', CIDir])

    // Remove package lock
    const packLock = path.join(packageName, 'package-lock.json')
    console.info('Removing package-lock.json...')
    await exec('rm', [packLock])

    // Update package info
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

    // Update index file
    console.info('Updating index.html...')
    const indexFile = path.join(packageName, 'index.html')
    let index = await readFile(indexFile, { encoding: 'utf8' })
    index = index.replace(/<title>[^<]+<\/title>/, `<title>${appName}</title>`)
    await writeFile(indexFile, index)

    // Update home page
    console.info('Updating home.vue...')
    const homePageFile = path.join(packageName, 'src', 'pages', 'home.vue')
    let homePage = await readFile(homePageFile, { encoding: 'utf8' })
    homePage = homePage.replace(/<h1>[^<]+<\/h1>/, `<h1>${appName}</h1>`)
    await writeFile(homePageFile, homePage)

    // Update readme
    console.info('Updating README.md...')
    const readmeFile = path.join(packageName, 'README.md')
    let readme = await readFile(readmeFile, { encoding: 'utf8' })
    // Set title
    readme = readme.replace(/.*(\s)+(=+)/m, `${appName}$1${'='.repeat(appName.length)}`)
    // Update description
    readme = readme.replace(/(=+\s+)([\s\S]+)(?:Requirements)/, `$1${description}\n\nRequirements`)
    // Update installation instructions
    readme = readme.replace(/(Installation\s+-+)[\s\S]+manually:/, '$1')
    readme = readme.replace(/git clone [^`]+/, `git clone ${repoURL}`)
    // Remove usage block
    readme = readme.replace(/Usage\s+-+[\s\S]+Deployment/, 'Deployment')
    await writeFile(readmeFile, readme)

    // Update license
    console.info('Updating LICENSE...')
    const licenseFile = path.join(packageName, 'LICENSE')
    let licenseContents = await readFile(licenseFile, { encoding: 'utf8' })
    licenseContents = licenseContents.replace(/Copyright \(c\).*/, `Copyright (c) ${new Date().getFullYear()} ${author}`)
    await writeFile(licenseFile, licenseContents)

    // Starting new repo
    console.info('Starting new git repository...')
    await exec('git', ['init'], { cwd: appDir })

    // Add git remote
    if (repoURL) {
        console.info(`Adding git remote "origin" for ${repoURL}...`)
        await exec('git', ['remote', 'add', 'origin', repoURL], { cwd: appDir })
    }
    else {
        console.warn('Skipping adding git remote, no repository information...')
    }

    // Install dependencies
    console.info('Installing dependencies...')
    await exec('npm', ['install'], { cwd: appDir })

    console.success(`Done! New app ready at ${path.join(process.cwd(), packageName)}`)
}

run()