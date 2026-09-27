import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ExperimentRunModel } from '@/models/Experiment';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');
    const datasetId = searchParams.get('datasetId') || 'all';

    const conn = await connectToDatabase();
    if (!conn) {
      return NextResponse.json(
        { error: 'MongoDB unreachable', runs: [] },
        { status: 503 }
      );
    }

    const query: any = {};
    if (modelId) query.modelId = modelId;
    if (datasetId !== 'all') query.datasetId = datasetId;

    // Retrieve only epoch trajectories (history) for the requested model & dataset
    const runs = await ExperimentRunModel.find(query)
      .select('modelId datasetId seed bestEpoch history')
      .lean();

    return NextResponse.json({
      source: 'mongodb',
      count: runs.length,
      runs,
    });
  } catch (error: any) {
    console.error('API /api/experiments/curves error:', error);
    return NextResponse.json(
      { error: error.message, runs: [] },
      { status: 500 }
    );
  }
}
