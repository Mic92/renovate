import { exec } from '../../../util/exec';
import { extractPackageFile } from '.';

vi.mock('../../../util/exec');

const execMock = vi.mocked(exec);

describe('modules/manager/nix/extract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when nix flake metadata fails', async () => {
    execMock.mockRejectedValueOnce(new Error('nix command failed'));
    expect(await extractPackageFile('', 'flake.nix')).toBeNull();
  });

  it('returns null when no stdout from nix command', async () => {
    execMock.mockResolvedValueOnce({ stdout: '', stderr: '' });
    expect(await extractPackageFile('', 'flake.nix')).toBeNull();
  });

  it('returns null when no inputs exist', async () => {
    const metadata = {
      locks: {
        nodes: {
          root: {
            inputs: {},
          },
        },
      },
    };
    execMock.mockResolvedValueOnce({
      stdout: JSON.stringify(metadata),
      stderr: '',
    });
    expect(await extractPackageFile('', 'flake.nix')).toBeNull();
  });

  it('extracts nixpkgs input with ref', async () => {
    const metadata = {
      locks: {
        nodes: {
          root: {
            inputs: {
              nixpkgs: 'nixpkgs',
            },
          },
          nixpkgs: {
            locked: {
              ref: 'nixos-21.11',
              rev: '9f4128e00b0ae8ec65918efeba59db998750ead6',
              type: 'github',
            },
            original: {
              ref: 'nixos-21.11',
              type: 'github',
            },
          },
        },
      },
    };
    execMock.mockResolvedValueOnce({
      stdout: JSON.stringify(metadata),
      stderr: '',
    });
    expect(await extractPackageFile('', 'flake.nix')).toEqual({
      deps: [
        {
          depName: 'nixpkgs',
          currentValue: 'nixos-21.11',
          currentDigest: '9f4128e00b0ae8ec65918efeba59db998750ead6',
          datasource: 'nix-flake',
          packageName: '.#nixpkgs',
          rangeStrategy: 'update-lockfile',
        },
      ],
    });
  });

  it('extracts input without ref but with digest', async () => {
    const metadata = {
      locks: {
        nodes: {
          root: {
            inputs: {
              nixpkgs: 'nixpkgs',
            },
          },
          nixpkgs: {
            locked: {
              rev: '612ee628421ba2c1abca4c99684862f76cb3b089',
              type: 'github',
            },
            original: {
              type: 'github',
            },
          },
        },
      },
    };
    execMock.mockResolvedValueOnce({
      stdout: JSON.stringify(metadata),
      stderr: '',
    });
    expect(await extractPackageFile('', 'flake.nix')).toEqual({
      deps: [
        {
          depName: 'nixpkgs',
          currentValue: undefined,
          currentDigest: '612ee628421ba2c1abca4c99684862f76cb3b089',
          datasource: 'nix-flake',
          packageName: '.#nixpkgs',
          rangeStrategy: 'update-lockfile',
        },
      ],
    });
  });

  it('extracts tarball input with narHash', async () => {
    const metadata = {
      locks: {
        nodes: {
          root: {
            inputs: {
              'nixpkgs-lib': 'nixpkgs-lib',
            },
          },
          'nixpkgs-lib': {
            locked: {
              narHash: 'sha256-xTMgDkSH8yNTQRlIiZj1AqNXFnYHnLO1h8vB0z+hUmI=',
              type: 'tarball',
              url: 'https://github.com/NixOS/nixpkgs/archive/23.11.tar.gz',
            },
            original: {
              type: 'tarball',
              url: 'https://github.com/NixOS/nixpkgs/archive/23.11.tar.gz',
            },
          },
        },
      },
    };
    execMock.mockResolvedValueOnce({
      stdout: JSON.stringify(metadata),
      stderr: '',
    });
    expect(await extractPackageFile('', 'flake.nix')).toEqual({
      deps: [
        {
          depName: 'nixpkgs-lib',
          currentValue: undefined,
          currentDigest: 'sha256-xTMgDkSH8yNTQRlIiZj1AqNXFnYHnLO1h8vB0z+hUmI=',
          datasource: 'nix-flake',
          packageName: '.#nixpkgs-lib',
          rangeStrategy: 'update-lockfile',
        },
      ],
    });
  });

  it('skips indirect input types', async () => {
    const metadata = {
      locks: {
        nodes: {
          root: {
            inputs: {
              nixpkgs: 'nixpkgs',
            },
          },
          nixpkgs: {
            locked: {
              rev: 'b69de56fac8c2b6f8fd27f2eca01dcda8e0a4221',
              type: 'github',
            },
            original: {
              id: 'nixpkgs',
              type: 'indirect',
            },
          },
        },
      },
    };
    execMock.mockResolvedValueOnce({
      stdout: JSON.stringify(metadata),
      stderr: '',
    });
    expect(await extractPackageFile('', 'flake.nix')).toBeNull();
  });

  it('skips path input types', async () => {
    const metadata = {
      locks: {
        nodes: {
          root: {
            inputs: {
              nixpkgs: 'nixpkgs',
            },
          },
          nixpkgs: {
            locked: {
              path: '/nix/store/22qgs3skscd9bmrxv9xv4q5d4wwm5ppx-source',
              type: 'path',
            },
            original: {
              id: 'nixpkgs',
              type: 'path',
            },
          },
        },
      },
    };
    execMock.mockResolvedValueOnce({
      stdout: JSON.stringify(metadata),
      stderr: '',
    });
    expect(await extractPackageFile('', 'flake.nix')).toBeNull();
  });

  it('extracts multiple inputs', async () => {
    const metadata = {
      locks: {
        nodes: {
          root: {
            inputs: {
              nixpkgs: 'nixpkgs',
              'flake-utils': 'flake-utils',
            },
          },
          nixpkgs: {
            locked: {
              ref: 'nixos-unstable',
              rev: '9f4128e00b0ae8ec65918efeba59db998750ead6',
              type: 'github',
            },
            original: {
              ref: 'nixos-unstable',
              type: 'github',
            },
          },
          'flake-utils': {
            locked: {
              rev: 'c1dfcf08411b08f6b8615f7d8971a2bfa81d5e8a',
              type: 'github',
            },
            original: {
              type: 'github',
            },
          },
        },
      },
    };
    execMock.mockResolvedValueOnce({
      stdout: JSON.stringify(metadata),
      stderr: '',
    });
    expect(await extractPackageFile('', 'flake.nix')).toEqual({
      deps: [
        {
          depName: 'nixpkgs',
          currentValue: 'nixos-unstable',
          currentDigest: '9f4128e00b0ae8ec65918efeba59db998750ead6',
          datasource: 'nix-flake',
          packageName: '.#nixpkgs',
          rangeStrategy: 'update-lockfile',
        },
        {
          depName: 'flake-utils',
          currentValue: undefined,
          currentDigest: 'c1dfcf08411b08f6b8615f7d8971a2bfa81d5e8a',
          datasource: 'nix-flake',
          packageName: '.#flake-utils',
          rangeStrategy: 'update-lockfile',
        },
      ],
    });
  });

  it('handles flake in subdirectory', async () => {
    const metadata = {
      locks: {
        nodes: {
          root: {
            inputs: {
              nixpkgs: 'nixpkgs',
            },
          },
          nixpkgs: {
            locked: {
              rev: '9f4128e00b0ae8ec65918efeba59db998750ead6',
              type: 'github',
            },
            original: {
              type: 'github',
            },
          },
        },
      },
    };
    execMock.mockResolvedValueOnce({
      stdout: JSON.stringify(metadata),
      stderr: '',
    });
    expect(await extractPackageFile('', 'subdir/flake.nix')).toEqual({
      deps: [
        {
          depName: 'nixpkgs',
          currentValue: undefined,
          currentDigest: '9f4128e00b0ae8ec65918efeba59db998750ead6',
          datasource: 'nix-flake',
          packageName: 'subdir#nixpkgs',
          rangeStrategy: 'update-lockfile',
        },
      ],
    });
  });

  it('skips nodes without locked data', async () => {
    const metadata = {
      locks: {
        nodes: {
          root: {
            inputs: {
              nixpkgs: 'nixpkgs',
            },
          },
          nixpkgs: {
            original: {
              type: 'github',
            },
          },
        },
      },
    };
    execMock.mockResolvedValueOnce({
      stdout: JSON.stringify(metadata),
      stderr: '',
    });
    expect(await extractPackageFile('', 'flake.nix')).toBeNull();
  });

  it('skips inputs without digest', async () => {
    const metadata = {
      locks: {
        nodes: {
          root: {
            inputs: {
              nixpkgs: 'nixpkgs',
            },
          },
          nixpkgs: {
            locked: {
              type: 'github',
            },
            original: {
              type: 'github',
            },
          },
        },
      },
    };
    execMock.mockResolvedValueOnce({
      stdout: JSON.stringify(metadata),
      stderr: '',
    });
    expect(await extractPackageFile('', 'flake.nix')).toBeNull();
  });
});
