import { OpenPosition, type Perp, type PerpManager, User } from '../dist';
import { setup } from './setup';

export async function view(perpManager: PerpManager): Promise<void> {
  const perps: Perp[] = await perpManager.getPerps();
  console.log('perps: ');
  for (const perp of perps) {
    console.log('id:', perp.id);
    console.log('mark:', await perp.mark());
    console.log('index:', await perp.index());
    console.log('beacon:', await perp.beacon());
    console.log('lastIndexUpdate:', await perp.lastIndexUpdate());
    console.log('openInterest:', await perp.openInterest());
    console.log('markTimeSeries:', await perp.markTimeSeries());
    console.log('indexTimeSeries:', await perp.indexTimeSeries());
    console.log('openInterestTimeSeries:', await perp.openInterestTimeSeries());
    console.log('fundingRateTimeSeries:', await perp.fundingRateTimeSeries());
    console.log('tradingBounds:', await perp.bounds());
    console.log('fees:', await perp.fees());
    console.log('fundingRate:', await perp.fundingRate());
    console.log('totalOpenMakerPnl:', await perp.totalOpenMakerPnl());
    console.log('totalOpenTakerPnl:', await perp.totalOpenTakerPnl());
    console.log();
  }
  console.log();

  const user = new User(perpManager.context);
  console.log('usdcBalance:', await user.usdcBalance());
  console.log();
  console.log('realizedPnl:', await user.realizedPnl());
  console.log('unrealizedPnl:', await user.unrealizedPnl());
  console.log('openPositions: ');
  for (const position of await user.openPositions()) {
    console.log('perpId:', position.perpId);
    console.log('inContractPosId:', position.positionId);
    console.log('liveDetails:', await position.liveDetails());
    console.log();
  }
  console.log('closedPositions: ');
  for (const position of await user.closedPositions()) {
    console.log('perpId:', position.perpId);
    console.log('wasMaker:', position.wasMaker);
    console.log('wasLong:', position.wasLong);
    console.log('pnlAtClose:', position.pnlAtClose);
    console.log();
  }
}

async function main() {
  const perpManager = setup();
  await view(perpManager);
}

main();
