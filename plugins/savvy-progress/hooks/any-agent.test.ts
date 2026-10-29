import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const PLUGIN = 'savvy-progress'
const PROGRESS = 'mcp__savvy-progress__progress'
const band = { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 100, scroll: { offset: 0, bodyRows: 4 }, view: {} }

const spawn = ($: Engine, id: string, subagentType = 'general-purpose') =>
  $.agent.spawn({ tool_use_id: `t-${id}`, prompt: 'p', description: `Work ${id}`, subagentType, provider: 'engine', parentModel: 'claude-opus-5-5', background: true, fork: false } as never)

const answer = ($: Engine, id: string) =>
  ($.turn.complete as (e: unknown) => Promise<unknown>)({ agentId: id, reason: 'answer', answer: 'ok', usage: null })

const label = async ($: Engine) => {
  const bar = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: band })
  return (await bar.findAll({ type: 'Text' })).map(el => el.text).join(' ')
}

test('any subagent starts the band, and it counts the batch through to done', async ($, on) => {
  mock.clock(on)
  let opened = 0
  on('ui.open', () => {
    opened++
    return { value: { isPlaced: true } }
  })
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `a${++n}` }))
  on('turn.complete', () => ({ text: '' }) as never)

  await spawn($, '1')
  await spawn($, '2')
  expect(await label($)).toMatch(/Subagents.*Tasks 0\/2/)
  expect(opened).toBe(1)

  await answer($, 'a1')
  expect(await label($)).toMatch(/Tasks 1\/2/)
  await answer($, 'a2')
  expect(await label($)).toMatch(/Done/)

  // A later batch starts over and opens the panel again.
  await spawn($, '3')
  expect(await label($)).toMatch(/Tasks 0\/1/)
  expect(opened).toBe(2)
})

test('a reported flow is left alone by other subagents', async ($, on) => {
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: 'a1' }))
  await $.tool.call({ tool: PROGRESS, title: 'Ship it', phase: 'delegate', total: 3, done: 1 } as never)
  await spawn($, '1')
  expect(await label($)).toMatch(/Ship it.*Tasks 1\/3/)
})
