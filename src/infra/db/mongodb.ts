import { MongoClient, type Db } from 'mongodb'

export type Config = { uri: string; dbName: string }

export type Client = { mongo: MongoClient; db: Db; close: () => Promise<void> }

export async function newClient(cfg: Config): Promise<Client> {
  const mongo = new MongoClient(cfg.uri, { serverSelectionTimeoutMS: 10_000 })
  await mongo.connect()
  try {
    await mongo.db('admin').command({ ping: 1 })
  } catch (err) {
    await mongo.close()
    throw new Error('ping mongodb', { cause: err })
  }
  return { mongo, db: mongo.db(cfg.dbName), close: () => mongo.close() }
}
