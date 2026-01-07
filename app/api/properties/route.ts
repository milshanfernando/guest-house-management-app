import { connectDB } from "@/lib/mongodb";
import Property from "@/models/Property";
import { NextResponse } from "next/server";

export async function GET() {
  await connectDB();
  const data = await Property.find();
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  await connectDB();
  const { name } = await req.json();
  const property = await Property.create({ name });
  return NextResponse.json(property);
}
