import os
from setuptools import find_packages
from setuptools import setup

folder = os.path.dirname(__file__)
version_path = os.path.join(folder, "src", "williamtoolbox", "version.py")

__version__ = None
with open(version_path) as f:
    exec(f.read(), globals())

req_path = os.path.join(folder, "requirements.txt")
install_requires = []
if os.path.exists(req_path):
    with open(req_path) as fp:
        install_requires = [line.strip() for line in fp]

readme_path = os.path.join(folder, "README.md")
readme_contents = ""
if os.path.exists(readme_path):
    with open(readme_path) as fp:
        readme_contents = fp.read().strip()

setup(
    name="williamtoolbox",
    version=__version__,
    description="williamtoolbox: William Toolbox",
    author="allwefantasy",
    long_description=readme_contents,
    long_description_content_type="text/markdown",
    entry_points={
        'console_scripts': [
            'william.toolbox = williamtoolbox.williamtoolbox_command:main',
            'william.toolbox.backend = williamtoolbox.server.backend_server:main',
            'william.toolbox.frontend = williamtoolbox.server.proxy_server:main',
        ],
    },
    package_dir={"": "src"},
    packages=find_packages("src"),    
    package_data={
        "williamtoolbox": ["web/**/*"],
    },
    install_requires=install_requires,
    classifiers=[        
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
    requires_python=">=3.9",
)
