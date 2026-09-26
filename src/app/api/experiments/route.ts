import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ModelModel, ExperimentRunModel } from '@/models/Experiment';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const datasetId = searchParams.get('datasetId') || 'all';

    const conn = await connectToDatabase();
    
    if (!conn) {
      return NextResponse.json({
        source: 'mongodb_unreachable',
        models: [],
        runs: [],
      });
    }

    const models = await ModelModel.find({}).lean();
    const query: any = {};
    if (datasetId !== 'all') {
      query.datasetId = datasetId;
    }

    const runs = await ExperimentRunModel.find(query).lean();

    return NextResponse.json({
      source: 'mongodb',
      models,
      runsCount: runs.length,
      runs,
    });
  } catch (error: any) {
    console.error('API /api/experiments error:', error);
    return NextResponse.json({
      source: 'error',
      models: [],
      runs: [],
      error: error.message,
    });
  }
}
