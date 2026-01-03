/**
 * Projects API Route
 */

import { NextRequest, NextResponse } from 'next/server'
import { getProjects, createProject } from '@/lib/writer-db'

export async function GET() {
  try {
    const projects = await getProjects()
    return NextResponse.json(projects)
  } catch (error) {
    console.error('Failed to get projects:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, description, system_prompt } = await req.json()

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const project = await createProject(name, description, system_prompt)
    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    console.error('Failed to create project:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
