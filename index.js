const tagUtil = require("./tags");
const semver = require('semver');
const core = require('@actions/core');
const github = require('@actions/github');

const {Octokit} = require('@octokit/rest');
const octokit = new Octokit({auth: core.getInput("token") || null});

async function getLatestTag(owner, repo, prefix, releasesOnly, sortTags) {
    const endpoint = (releasesOnly ? octokit.repos.listReleases : octokit.repos.listTags);
    const pages = endpoint.endpoint.merge({"owner": owner, "repo": repo, "per_page": 100});

    const tags = [];
    for await (const item of getItemsFromPages(pages)) {
        const tag = (releasesOnly ? item["tag_name"] : item["name"]);
        if (!tag.startsWith(prefix)) {
            continue;
        }
        if (!sortTags) {
            // Assume that the API returns the most recent tag(s) first.
            return tag;
        }
        tags.push(tag);
    }
    if (tags.length === 0) {
        let error = `The repository "${owner}/${repo}" has no `;
        error += releasesOnly ? "releases" : "tags";
        if (prefix) {
            error += ` matching "${prefix}*"`;
        }
        throw error;
    }
    return tags.sort(tagUtil.cmpTags).slice(-1).pop();
}

async function* getItemsFromPages(pages) {
    for await (const page of octokit.paginate.iterator(pages)) {
        for (const item of page.data) {
            yield item;
        }
    }
}

class DockerTags {
  constructor (tag, flavour = "", options={}) {
    this.tag = semver.parse(tag)
    this.nonsemver = ""

    if (this.tag == null) {
      this.nonsemver = tag
      core.warning(`Non semver tag is provided: ${tag}. Oops, no generation will be performed!`)
    }

    this.dropPositions = 0
    this.vTag = false
    this.flavour = flavour
    this.tagsLatest = false
    this.latest = ""

    if (options.updates && options.updates.includes("minor")) this.dropPositions = 1
    if (options.updates && options.updates.includes("major")) this.dropPositions = 2
    if (options.tagsLatest) this.tagsLatest = true
    if (options.latest) this.latest = options.latest

    if (this.tag && this.tag.raw.startsWith("v")) this.vTag = true
  }

  genTags(result, ...args) {
    var vtag, compacted = args.filter(function (e) { return e != "" })
    if (this.vTag) vtag = "v"

    result.push(vtag + compacted.join('-'))
  }

  generate() {
    if (this.tag == null) return [this.nonsemver]

    var vnum = [this.tag.major, this.tag.minor, this.tag.patch]
    var result = []

    // update full tag and the one with the prerelease
    this.genTags(result, vnum.join('.'), this.flavour, this.tag.prerelease)

    // current release is not the latest
    if (this.latest != "" && tagUtil.cmpTags(this.tag.raw, this.latest) < 0) {
      core.info(`Newer release detected: ${this.latest}, will release only ${result.slice(-1).pop()}.`)
      return result
    }

    // descend to minor and major
    for (var i = 0; i <= this.dropPositions; i++) {
      this.genTags(result, vnum.join('.'), this.flavour)
      vnum.pop()
    }

    // specify latest
    if (this.tagsLatest && this.flavour == "") result.push("latest")
    else if (this.tagsLatest) result.push(this.flavour)

    return result
  }
}

async function run() {
  try {
    const repo = github.context.repo
    const refp = github.context.ref.split('/').slice(-2)
    const flavour = core.getInput('flavour')
    const updates = core.getInput('updates')
    const image = core.getInput('image', {required: true})
    const tagsLatest =  (core.getInput("releases-only") || "true").toLowerCase() === "true"
    const prefix = ""
    const releasesOnly = (core.getInput("releases-only") || "false").toLowerCase() === "true";

    // lookup the latest release tag in github
    const latest = await getLatestTag(repo.owner, repo.repo, prefix, releasesOnly, true);

    // create tags generator
    const dt = new DockerTags(
      refp.slice(-1).pop(), flavour, 
      {
        updates: updates,
        tagsLatest: tagsLatest,
        latest: latest
      }
    )

    const tags = dt.generate()
    core.info(`Generated:  ${tags.join(' ')}`)

    core.setOutput("runsOnTag", refp[0] == 'tags')
    core.setOutput("tags", tags.join("\n"))
    core.setOutput("images", tags.map(t => `${image}:${t}`).join("\n"))

    if (dt.nonsemver == "" && dt.tag.version != "") {
      core.setOutput("version", dt.tag.version)
    }

  } catch (error) {
    core.setFailed(error);
  }
}

if (require.main === module) {
  run();
}
