import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ModelModel, ExperimentRunModel } from '@/models/Experiment';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const datasetId = searchParams.get('datasetId') || 'all';
    const includeEmbeddings = searchParams.get('includeEmbeddings') === 'true';

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

    // Exclude bulky embeddings coordinates arrays on main queries to keep response < 100KB
    let runsQuery = ExperimentRunModel.find(query);
    if (!includeEmbeddings) {
      runsQuery = runsQuery.select('-embeddingsData');
    }

    const runs = await runsQuery.lean();

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

