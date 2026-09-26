/**
 * Removes accounts created by the automated test scripts (smoke_*, ui_*, real_*, api_*)
 * plus their discoveries, copies, and any cards that only they had discovered.
 *   npx tsx src/scripts/cleanupTestUsers.ts
 */
import { connectDatabase, disconnectDatabase } from '../config/db';
import { Card } from '../models/Card';
import { Discovery } from '../models/Discovery';
import { OwnedCard } from '../models/OwnedCard';
import { User } from '../models/User';

await connectDatabase();
try {
  const users = await User.find({ username: /^(smoke|ui|real|api)_/, isSeed: { $ne: true } }).select('_id username').lean();
  const ids = users.map((u) => u._id);
  const touchedCards = await Discovery.distinct('cardId', { userId: { $in: ids } });

  const [d, o] = await Promise.all([
    Discovery.deleteMany({ userId: { $in: ids } }),
    OwnedCard.deleteMany({ ownerId: { $in: ids } }),
  ]);
  // Delete catalog cards nobody else has discovered; keep cards real players also found.
  let removedCards = 0;
  for (const cardId of touchedCards) {
    if (!(await Discovery.exists({ cardId })) && !(await OwnedCard.exists({ cardId }))) {
      await Card.deleteOne({ _id: cardId, isSeed: { $ne: true } });
      removedCards++;
    }
  }
  await User.deleteMany({ _id: { $in: ids } });
  console.log(
    `[cleanup] removed ${users.length} test users, ${d.deletedCount} discoveries, ${o.deletedCount} copies, ${removedCards} cards`,
  );
} finally {
  await disconnectDatabase();
}
