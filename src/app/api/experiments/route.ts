import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ModelModel, ExperimentRunModel } from '@/models/Experiment';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const datasetId = searchParams.get('datasetId') || 'all';
    const includeEmbeddings = searchParams.get('includeEmbeddings') === 'true';
    const includeCurves = searchParams.get('includeCurves') === 'true';

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

    // Tier 1 Fast Load: Exclude bulky embeddings and epoch histories on main queries to keep payload ~15KB
    let runsQuery = ExperimentRunModel.find(query);
    if (!includeEmbeddings && !includeCurves) {
      runsQuery = runsQuery.select('-embeddingsData -history');
    } else if (!includeEmbeddings) {
      runsQuery = runsQuery.select('-embeddingsData');
    } else if (!includeCurves) {
      runsQuery = runsQuery.select('-history');
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

