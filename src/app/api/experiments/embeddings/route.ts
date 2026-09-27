import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ExperimentRunModel } from '@/models/Experiment';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');
    const datasetId = searchParams.get('datasetId');
    const seed = searchParams.get('seed');

    if (!modelId || !datasetId || !seed) {
      return NextResponse.json(
        { error: 'Missing required parameters: modelId, datasetId, seed' },
        { status: 400 }
      );
    }

    const conn = await connectToDatabase();
    if (!conn) {
      return NextResponse.json(
        { error: 'MongoDB unreachable', embeddingsData: null },
        { status: 503 }
      );
    }

    const run = await ExperimentRunModel.findOne({
      modelId,
      datasetId,
      seed: Number(seed),
    })
      .select('modelId datasetId seed finalMetrics embeddingsData visualizations')
      .lean();

    if (!run) {
      return NextResponse.json(
        { error: 'Run not found', embeddingsData: null },
        { status: 404 }
      );
    }

    return NextResponse.json({
      modelId: run.modelId,
      datasetId: run.datasetId,
      seed: run.seed,
      finalMetrics: run.finalMetrics,
      embeddingsData: run.embeddingsData || {},
      visualizations: run.visualizations || {},
    });
  } catch (error: any) {
    console.error('API /api/experiments/embeddings error:', error);
    return NextResponse.json(
      { error: error.message, embeddingsData: null },
      { status: 500 }
    );
  }
}
