#!/usr/bin/env node
import { ArgumentParser } from 'argparse'
import { spawn } from 'child_process'
import 'fresh-console'
import { readFile, writeFile } from 'fs/promises'
import input from '@inquirer/input'
import path from 'path'
import slugify from 'slugify'

// Get version info from package.json
// TODO: replace with import once JSON assertions/with lands in Node
const packageInfo = JSON.parse(
    await readFile(new URL('./package.json', import.meta.url))
)

// eslint-disable-next-line camelcase
const parser = new ArgumentParser({ add_help: true, description: packageInfo.description })
parser.add_argument('-v', '--version', { action: 'version', version: packageInfo.version })
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

const ALL_LICENSES_URL = 'https://raw.githubusercontent.com/spdx/license-list-data/main/json/licenses.json'
async function fetchLicense(id) {
    const allLicensesResponse = await fetch(ALL_LICENSES_URL)
    if (allLicensesResponse.status !== 200) {
        throw new Error(`Unable to get available licenses from ${ALL_LICENSES_URL} (status ${allLicensesResponse.status}). Not adding license.`)
    }
    const { licenses } = await allLicensesResponse.json()
    const licenseDetails = licenses.find(l => l.licenseId === id)
    if (!licenseDetails) {
        throw new Error(`No SPDX license found matching '${id}'`)
    }
    console.info('License found. Creating...')
    const response = await fetch(licenseDetails.detailsUrl)
    const { licenseText } = await response.json()
    return licenseText
}

async function run() {
    console.info(`----- Front-End Generator v${packageInfo.version}------`)
    const appName = args.app_name || await input({ message: 'Name of app:', validate: val => val !== '' })
    const packageName = args.package_name || await input({ message: 'Package name:', default: slugify(appName.toLowerCase(), { strict: true }) })
    const author = args.package_author || await input({ message: 'Author:' })
    const description = args.package_description || await input({ message: 'Description:' })
    const version = args.package_version || await input({ message: 'Initial version:', default: '0.1.0', validate: v => v.match(/[0-9]+\.[0-9]+\.[0-9]+/) !== null })
    const license = args.package_license || await input({ message: 'License:', default: 'MIT' })
    const repoURL = args.package_url || await input({ message: 'Repository URL:' })

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
    // Update license info
    readme = readme.replace('MIT', license)
    // Remove usage block
    readme = readme.replace(/Usage\s+-+[\s\S]+Deployment/, 'Deployment')
    await writeFile(readmeFile, readme)

    // Find license file
    console.info(`Attempting to fetch '${license}' license...`)
    const licenseFile = path.join(packageName, 'LICENSE')
    try {
        const licenseText = await fetchLicense(license)
        const licenseContents = licenseText
            .replace('<year>', new Date().getFullYear())
            .replace('<copyright holders>', author)
        await writeFile(licenseFile, licenseContents)
    } catch (e) {
        console.warn(`${e}. Skipping LICENSE creation...`)
        await exec('rm', [licenseFile])
    }

    // Starting new repo
    console.info('Starting new git repository...')
    await exec('git', ['init'], { cwd: appDir })

    // Add git remote
    if (repoURL) {
        console.info(`Adding git remote "origin" for ${repoURL}...`)
        await exec('git', ['remote', 'add', 'origin', repoURL], { cwd: appDir })
    } else {
        console.warn('Skipping adding git remote, no repository information...')
    }

    // Install dependencies
    console.info('Installing dependencies...')
    await exec('npm', ['install'], { cwd: appDir })

    // eslint-disable-next-line no-console
    console.success(`Done! New app ready at ${path.join(process.cwd(), packageName)}`)
}

run()