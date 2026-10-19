import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ObjectId } from 'mongodb'
import { UpsertClipRequest } from './clip.dto.js'
import type { Clip } from './clip.model.js'
import { orderByFoods } from './clip.service.js'

const tomyum = new ObjectId()
const somtam = new ObjectId()
const clip = (title: string, foods: ObjectId[]): Clip => ({
  _id: new ObjectId(),
  youtubeId: 'aaaaaaaaaaa',
  title,
  channel: 'c',
  durationSec: 60,
  foodIds: foods,
  tags: [],
  createdAt: new Date(0),
  updatedAt: new Date(0),
})

test('clips follow the order of the recommended foods', () => {
  const got = orderByFoods([clip('somtam how-to', [somtam]), clip('tomyum how-to', [tomyum])], [tomyum.toHexString(), somtam.toHexString()])
  assert.deepEqual(
    got.map((c) => c.title),
    ['tomyum how-to', 'somtam how-to'],
  )
})

test('youtubeId accepts a bare id or a full link, rejects anything else', () => {
  const base = { title: 't', channel: 'c', durationSec: 60 }
  assert.equal(UpsertClipRequest.parse({ ...base, youtubeId: 'dQw4w9WgXcQ' }).youtubeId, 'dQw4w9WgXcQ')
  assert.equal(UpsertClipRequest.parse({ ...base, youtubeId: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10' }).youtubeId, 'dQw4w9WgXcQ')
  assert.equal(UpsertClipRequest.parse({ ...base, youtubeId: 'https://youtu.be/dQw4w9WgXcQ' }).youtubeId, 'dQw4w9WgXcQ')
  assert.throws(() => UpsertClipRequest.parse({ ...base, youtubeId: 'javascript:alert(1)' }))
})
