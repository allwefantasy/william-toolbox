import argparse
from williamtoolbox.server import backend_server, proxy_server

def main():
    parser = argparse.ArgumentParser(description="William Toolbox")
    parser.add_argument('--backend', action='store_true', help='Start the backend server')
    parser.add_argument('--frontend', action='store_true', help='Start the frontend (proxy) server')
    args = parser.parse_args()

    if args.backend:
        backend_server.main()
    elif args.frontend:
        proxy_server.main()
    else:
        print("Please specify either --backend or --frontend")

if __name__ == "__main__":
    main()