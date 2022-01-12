import {getTargetPullRequests} from '../src/run'

jest.mock('dayjs', () =>
  jest.fn((...args) =>
    jest.requireActual('dayjs')(
      args.filter(arg => arg).length > 0 ? args : '2022-01-08T06:00:00Z'
    )
  )
)

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
        '3',
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
        '9',
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
        '3',
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
        '3',
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
