import * as core from '@actions/core'
import * as github from '@actions/github'
import { GitHub } from '@actions/github/lib/utils';
import { Base64 } from 'js-base64';
import { JSDOM } from 'jsdom'
import { parse } from './parser'

type Readme = {
    response: any,
    content: string
}

type Contributor = {
    login: string,
    html_url: string,
    response: any
}

type Repo = {
    owner: string,
    repo: string
}

async function getREADME(repo: Repo, octokit: InstanceType<typeof GitHub>): Promise<Readme> {
    let response: any = (await octokit.rest.repos.getContent({
        owner: repo.owner,
        repo: repo.repo,
        path: 'README.md'
    })).data

    let base64Content = response.content
    let content = Base64.decode(base64Content)
    return {
        response,
        content
    }
}

async function getContributors(repo: Repo, octokit: InstanceType<typeof GitHub>): Promise<Contributor[]> {
    let contributors = (await octokit.rest.repos.listContributors({
        owner: repo.owner,
        repo: repo.repo
    })).data

    return contributors.map(v => {
        return {
            login: v.login,
            html_url: v.html_url,
            response: v
        } as Contributor
    })
}

async function run() {
    try {
        const myToken = core.getInput('gh_token');
        const rawRepo = core.getInput('repo').split("/")
        let repo = { owner: rawRepo[0], repo: rawRepo[1] } as Repo
        
        const varsRaw = core.getInput('vars');
        let vars: any; 
        if (varsRaw != "") {
            vars = JSON.parse(varsRaw)
        } else {
            vars = {}
        }

        const octokit = github.getOctokit(myToken)
        let readme = (await getREADME(repo, octokit))
        let contributors = (await getContributors(repo, octokit))

        let jsdom = new JSDOM(readme.content);
        let contributorsTags = jsdom.window.document.querySelectorAll("contributors");
        contributorsTags.forEach(tag => {
            tag.innerHTML = ""
            let excludeRaw = tag?.getAttribute("exclude") ?? ""
            let includeRaw = tag?.getAttribute("include") ?? ""
            let exclude = parse(excludeRaw, vars)
            let include = parse(includeRaw, vars)
            let filtered = contributors.filter(i => !exclude.includes(i.login) || include.includes(i.login))
            
            filtered.forEach(contributor => {
                tag.innerHTML += `- [${contributor.login}](${contributor.html_url})\n`
            })
        })
        let newREADME = Base64.encode(jsdom.window.document.body?.innerHTML)
        if (newREADME == readme.response.content) {
            return
        }
        await octokit.rest.repos.createOrUpdateFileContents({
            owner: repo.owner,
            repo: repo.repo,
            path: "README.md",
            message: "Update Contributors",
            content: newREADME,
            committer: {
                name: `MonunDocs Bot`,
                email: "admin@monun.me",
            },
            author: {
                name: "MonunDocs Bot",
                email: "admin@monun.me",
            },
            sha: readme.response.sha
        })
        const payload = JSON.stringify(github.context.payload, undefined, 2)
        console.log(`The event payload: ${payload}`);
    } catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
        }
    }
}

run()