import * as core from '@actions/core'
import * as github from '@actions/github'
import {getTargetPullRequests, run} from '../src/run'

jest.mock('dayjs', () =>
  jest.fn((...args) =>
    jest.requireActual('dayjs')(
      args.filter(arg => arg).length > 0 ? args : '2022-01-08T06:00:00Z'
    )
  )
)
jest.mock('@actions/github')
jest.mock('@actions/core')

describe('getTargetPullRequests', () => {
  test('return filtered pull requests which it being opened more than certain hours.', () => {
    expect(
      getTargetPullRequests(
        [
          {
            number: 1,
            createdAt: '2022-01-08T00:00:00Z',
            reviewDecision: null,
            timelineItems: {
              nodes: []
            }
          }
        ],
        3,
        false
      )
    ).toEqual([
      {
        number: 1,
        createdAt: '2022-01-08T00:00:00Z',
        reviewDecision: null,
        timelineItems: {
          nodes: []
        }
      }
    ])
  })

  test('return empty array which it being opened less than certain hours.', () => {
    expect(
      getTargetPullRequests(
        [
          {
            number: 1,
            createdAt: '2022-01-08T00:00:00Z',
            reviewDecision: null,
            timelineItems: {
              nodes: []
            }
          }
        ],
        9,
        false
      )
    ).toEqual([])
  })

  test('return filtered pull requests which it being ready for review more than certain hours.', () => {
    expect(
      getTargetPullRequests(
        [
          {
            number: 1,
            createdAt: '2022-01-08T00:00:00Z',
            reviewDecision: null,
            timelineItems: {
              nodes: [
                {
                  createdAt: '2022-01-08T04:00:00Z'
                }
              ]
            }
          }
        ],
        3,
        false
      )
    ).toEqual([])
  })

  test('return filtered pull requests which it being opened more than certain hours and review status is not approved.', () => {
    expect(
      getTargetPullRequests(
        [
          {
            number: 1,
            createdAt: '2022-01-08T00:00:00Z',
            reviewDecision: null,
            timelineItems: {
              nodes: []
            }
          },
          {
            number: 2,
            createdAt: '2022-01-08T00:00:00Z',
            reviewDecision: 'APPROVED',
            timelineItems: {
              nodes: []
            }
          }
        ],
        3,
        true
      )
    ).toEqual([
      {
        number: 1,
        createdAt: '2022-01-08T00:00:00Z',
        reviewDecision: null,
        timelineItems: {
          nodes: []
        }
      }
    ])
  })
})

describe('run', () => {
  beforeEach(() => {
    jest.spyOn(core, 'getInput').mockImplementation((name: string) => {
      switch (name) {
        case 'repo-token':
          return 'token'
        case 'hours-before-add-label':
          return '3'
        case 'label-name':
          return 'waiting for review'
        case 'skip-approved-pull-request':
          return 'false'
        default:
          ''
      }
      return ''
    })

    // @ts-expect-error
    github.context = {
      repo: {
        owner: 'kentaro-m',
        repo: 'waiting-for-review-labeler'
      }
    }
  })

  test('add a label to a pull request if target pull requests exist.', async () => {
    const octokit: any = {
      rest: {
        issues: {
          addLabels: jest.fn()
        }
      },
      graphql: jest.fn()
    }
    jest.spyOn(github, 'getOctokit').mockImplementation(() => octokit)
    jest.spyOn(octokit, 'graphql').mockImplementation(async () => ({
      search: {
        nodes: [
          {
            number: 1,
            createdAt: '2022-01-08T00:00:00Z',
            reviewDecision: null,
            timelineItems: {
              nodes: []
            }
          }
        ]
      }
    }))

    const spy = jest
      .spyOn(octokit.rest.issues, 'addLabels')
      .mockImplementation(() => {})

    await run()

    expect(spy.mock.calls[0][0]).toEqual({
      owner: 'kentaro-m',
      repo: 'waiting-for-review-labeler',
      issue_number: 1,
      labels: ['waiting for review']
    })
  })

  test("don't add a label to a pull request if pull request search results are not found.", async () => {
    const octokit: any = {
      rest: {
        issues: {
          addLabels: jest.fn()
        }
      },
      graphql: jest.fn()
    }
    jest.spyOn(github, 'getOctokit').mockImplementation(() => octokit)
    jest.spyOn(octokit, 'graphql').mockImplementation(async () => ({
      search: {
        nodes: []
      }
    }))
    const spy = jest
      .spyOn(octokit.rest.issues, 'addLabels')
      .mockImplementation(() => {})

    await run()

    expect(spy).not.toBeCalled()
  })

  test("don't add a label to a pull request if target pull requests are not exist.", async () => {
    const octokit: any = {
      rest: {
        issues: {
          addLabels: jest.fn()
        }
      },
      graphql: jest.fn()
    }
    jest.spyOn(github, 'getOctokit').mockImplementation(() => octokit)
    jest.spyOn(octokit, 'graphql').mockImplementation(async () => ({
      search: {
        nodes: [
          {
            number: 1,
            createdAt: '2022-01-08T05:00:00Z',
            reviewDecision: null,
            timelineItems: {
              nodes: []
            }
          }
        ]
      }
    }))
    const spy = jest
      .spyOn(octokit.rest.issues, 'addLabels')
      .mockImplementation(() => {})

    await run()

    expect(spy).not.toBeCalled()
  })

  test("don't add a label to a pull request if hours-before-add-label is not a number.", async () => {
    const octokit: any = {
      rest: {
        issues: {
          addLabels: jest.fn()
        }
      },
      graphql: jest.fn()
    }
    jest.spyOn(github, 'getOctokit').mockImplementation(() => octokit)
    jest.spyOn(octokit, 'graphql').mockImplementation(async () => ({
      search: {
        nodes: [
          {
            number: 1,
            createdAt: '2022-01-08T05:00:00Z',
            reviewDecision: null,
            timelineItems: {
              nodes: []
            }
          }
        ]
      }
    }))
    jest.spyOn(core, 'getInput').mockImplementation((name: string) => {
      switch (name) {
        case 'repo-token':
          return 'token'
        case 'hours-before-add-label':
          return 'foo'
        case 'label-name':
          return 'waiting for review'
        case 'skip-approved-pull-request':
          return 'false'
        default:
          ''
      }
      return ''
    })
    const spy = jest
      .spyOn(octokit.rest.issues, 'addLabels')
      .mockImplementation(() => {})

    await run()

    expect(spy).not.toBeCalled()
  })
})
