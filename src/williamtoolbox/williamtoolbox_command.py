
import os
import argparse
from pathlib import Path
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
        
        # Save as txt files
        for doc_text in doc_texts:
            txt_path = doc_dir / f"{Path(doc_text.doc_text).stem}.txt"
            with open(txt_path, "w", encoding="utf-8") as f:
                f.write(doc_text.doc_text)
                if doc_text.annotations:
                    f.write("\n\nAnnotations:\n")
                    for annotation in doc_text.annotations:
                        f.write(f"- {annotation.text}: {annotation.comment}\n")
        
        print(f"Processed {len(doc_texts)} docx files, saved to {doc_dir}")

if __name__ == "__main__":
    main()