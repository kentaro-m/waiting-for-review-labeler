import * as core from '@actions/core'
import * as github from '@actions/github'
import dayjs from 'dayjs'

type QueryResponse = {
  search: {
    nodes: PullRequest[]
  }
}

type PullRequest = {
  number: number
  createdAt: string
  reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null
  timelineItems: {
    nodes:
      | {
          createdAt: string
        }[]
      | []
  }
}

type GetTargetPullRequests = (
  pullRequests: PullRequest[],
  hoursBeforeLabelAdd: string,
  skipApprovedPullRequest: boolean
) => (PullRequest | undefined)[]

const getTargetPullRequests: GetTargetPullRequests = (
  pullRequests,
  hoursBeforeLabelAdd,
  skipApprovedPullRequest
) => {
  return pullRequests
    .map(pullRequest => {
      const createdAt =
        pullRequest.timelineItems.nodes.length === 0
          ? pullRequest.createdAt
          : pullRequest.timelineItems.nodes[0].createdAt
      const from = dayjs(createdAt)
      const to = dayjs()
      core.debug(`from: ${from.toISOString()}`)
      core.debug(`to: ${to.toISOString()}`)
      const diff = to.diff(from, 'hour')
      core.debug(`waiting time for review: ${diff}`)

      if (diff < parseInt(hoursBeforeLabelAdd, 10)) {
        return
      }

      if (
        skipApprovedPullRequest &&
        pullRequest.reviewDecision === 'APPROVED'
      ) {
        return
      }

      return pullRequest
    })
    .filter(v => v !== undefined)
}

const query = `
fragment pr on PullRequest {
  ... on PullRequest {
    number
    createdAt
    timelineItems(itemTypes: READY_FOR_REVIEW_EVENT, first: 1) {
      nodes {
        ... on ReadyForReviewEvent {
          createdAt
        }
      }
    }
  }
}

query ($q: String!, $limit: Int = 20) {
  search(first: $limit, type: ISSUE, query: $q) {
    nodes {
      ...pr
    }
  }
}
`

export async function run(): Promise<void> {
  try {
    const hoursBeforeLabelAdd = core.getInput('hours-before-label-add', {
      required: true
    })
    const labelName = core.getInput('label-name', {
      required: false
    })
    const skipProcess = core.getInput('skip-approved-pull-request', {
      required: false
    })
    const token = core.getInput('repo-token', {required: false})
    const octokit = github.getOctokit(token)
    const context = github.context
    const repoWithOwner = `${context.repo.owner}/${context.repo.repo}`
    const response = await octokit.graphql<QueryResponse>(query, {
      q: `is:pr is:open draft:false repo:${repoWithOwner}`
    })

    core.debug('fetch pull request data:')
    core.debug(JSON.stringify(response))

    const pullRequests = response.search.nodes

    if (pullRequests.length === 0) {
      return
    }

    const targetPullRequests = getTargetPullRequests(
      pullRequests,
      hoursBeforeLabelAdd,
      skipProcess === 'true'
    )

    if (!targetPullRequests || targetPullRequests.length === 0) {
      return
    }

    core.debug('get target pull request data:')
    core.debug(JSON.stringify(targetPullRequests))

    for (const pullRequest of targetPullRequests) {
      pullRequest?.number &&
        (await octokit.rest.issues.addLabels({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: pullRequest?.number,
          labels: [labelName]
        }))
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}
