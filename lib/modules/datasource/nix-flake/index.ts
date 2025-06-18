import { logger } from '../../../logger';
import { Datasource } from '../datasource';
import type { DigestConfig, GetReleasesConfig, ReleaseResult } from '../types';

export class NixFlakeDatasource extends Datasource {
  static readonly id = 'nix-flake';

  constructor() {
    super(NixFlakeDatasource.id);
  }

  override readonly customRegistrySupport = false;

  override getReleases({
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // For Nix flakes, we return a dummy release
    // The actual version checking happens in getDigest
    // This is because flake inputs don't have traditional "versions"
    logger.debug(`getReleases for nix flake: ${packageName}`);

    return Promise.resolve({
      releases: [
        {
          version: 'current',
        },
      ],
    });
  }

  override getDigest(
    { packageName }: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    // For Nix flakes, digest checking requires executing nix commands
    // which should be done by the manager, not the datasource
    // Return a static digest to indicate "check for updates"
    logger.debug(`getDigest for nix flake: ${packageName}`);
    return Promise.resolve('check-for-update');
  }
}
