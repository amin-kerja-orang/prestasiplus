import { InMemoryBijakAggregate } from '../fakes/in-memory-bijak-aggregate'
import { describeBijakAggregatePort } from './bijak-aggregate.contract'

describeBijakAggregatePort('InMemoryBijakAggregate', async (seed) => {
  const port = new InMemoryBijakAggregate()
  for (const { fact, ...extra } of seed.sittings) port.addSitting(fact, extra)
  for (const i of seed.items) port.addItem(i)
  return port
})
