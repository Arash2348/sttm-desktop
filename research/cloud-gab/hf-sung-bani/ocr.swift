import Foundation
import Vision
import AppKit
// ocr.swift <dir> -> prints one JSON line per png: {"f":name,"lines":[[y,text],...]} (y = top, 0..1 from top)
let dir = CommandLine.arguments[1]
let files = try FileManager.default.contentsOfDirectory(atPath: dir).filter { $0.hasSuffix(".png") }.sorted()
for f in files {
  guard let img = NSImage(contentsOfFile: dir + "/" + f), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { continue }
  let req = VNRecognizeTextRequest()
  req.recognitionLevel = .accurate
  req.recognitionLanguages = ["en-US"]
  req.usesLanguageCorrection = false
  try? VNImageRequestHandler(cgImage: cg, options: [:]).perform([req])
  var lines: [[Any]] = []
  for o in req.results ?? [] { if let c = o.topCandidates(1).first { lines.append([Double(1 - o.boundingBox.maxY), Double(o.boundingBox.minX), c.string]) } }
  let data = try JSONSerialization.data(withJSONObject: ["f": f, "lines": lines])
  print(String(data: data, encoding: .utf8)!)
}
