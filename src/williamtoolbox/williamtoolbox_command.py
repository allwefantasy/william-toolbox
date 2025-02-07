
import os
import argparse
from pathlib import Path
import json
from .annotation import process_docx_files

def main():
    parser = argparse.ArgumentParser(description="William Toolbox CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Annotation command
    annotation_parser = subparsers.add_parser("annotation", help="Process docx files for annotation")
    annotation_parser.add_argument("doc_dir", help="Directory containing docx files to process")

    args = parser.parse_args()

    if args.command == "annotation":
        doc_dir = Path(args.doc_dir)
        if not doc_dir.exists():
            print(f"Directory {doc_dir} does not exist")
            return

        # Process docx files
        doc_texts = process_docx_files(str(doc_dir))
        
        # Save as JSON files
        for doc_text in doc_texts:
            name = os.path.basename(doc_text.doc_name)
            json_path = doc_dir / f"{name}.json"
            data = {
                "doc_text": doc_text.doc_text,
                "annotations": [
                    {
                        "text": annotation.text,
                        "comment": annotation.comment,
                        "timestamp": annotation.timestamp if hasattr(annotation, "timestamp") else None
                    }
                    for annotation in doc_text.annotations
                ]
            }
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"Processed {len(doc_texts)} docx files, saved to {doc_dir}")

if __name__ == "__main__":
    main()