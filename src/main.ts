import * as path from 'path'
import {filePaths, parseConfig, unmatchedPatterns} from './util'
import {info, notice, setFailed} from '@actions/core'
import {createClient} from 'webdav'
import {createReadStream} from 'fs'
import {Agent} from 'https'

async function run(): Promise<void> {
    const config = parseConfig()

    const patterns = await unmatchedPatterns(config.files)
    for (const pattern of patterns) {
        notice(`🤔 Pattern '${pattern}' does not match any files.`)
    }
    if (patterns.length > 0 && config.failOnUnmatchedFiles) {
        throw new Error(`⛔ There were unmatched files`)
    }

    const files = await filePaths(config.files)
    if (files.length === 0) {
        notice(`🤔 ${config.files} not include valid file.`)
    }

    let HttpsAgent;

    if (config.webdavCert || config.webdavCa || config.webdavKey) {
        HttpsAgent = new Agent({
            cert: config.webdavCert,
            ca: config.webdavCa,
            key: config.webdavKey,
        })
    }

    const client = createClient(config.webdavAddress, {
        username: config.webdavUsername,
        password: config.webdavPassword,
        httpsAgent: HttpsAgent
    })

    // first be sure there are have directory
    if ((await client.exists(config.webdavUploadPath)) === false) {
        await client.createDirectory(config.webdavUploadPath, {recursive: true})
    }
    for (const file of files) {
        const uploadPath = path.join(
            config.webdavUploadPath,
            path.basename(file)
        )
        try {
            info(`📦 Uploading ${file} to ${uploadPath}`)
            createReadStream(file).pipe(client.createWriteStream(uploadPath))
            notice(`🎉 Uploaded ${uploadPath}`)
        } catch (error) {
            info(`error: ${error}`)
            notice(`⛔ Failed to upload file '${file}' to '${uploadPath}'`)
        }
    }
}

run().catch(err => setFailed(err.message))
