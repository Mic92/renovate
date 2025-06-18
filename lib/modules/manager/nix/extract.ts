import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import { NixFlakeDatasource } from '../../datasource/nix-flake';
import type { PackageDependency, PackageFileContent } from '../types';

export async function extractPackageFile(
  content: string,
  packageFile: string,
): Promise<PackageFileContent | null> {
  logger.debug(`nix.extractPackageFile(${packageFile})`);

  const deps: PackageDependency[] = [];
  // Get directory containing the flake file
  const dirMatch = /^(.*)\/[^/]+$/.exec(packageFile);
  const flakeDir = dirMatch ? dirMatch[1] : '.';

  // Use nix flake metadata to detect all inputs
  const execOptions: ExecOptions = {
    cwdFile: packageFile,
  };

  try {
    const result = await exec(
      'nix --extra-experimental-features "nix-command flakes" flake metadata --json .',
      execOptions,
    );

    if (!result.stdout) {
      return null;
    }

    const metadata = JSON.parse(result.stdout);
    const rootInputs = metadata.locks?.nodes?.root?.inputs;

    if (!rootInputs) {
      logger.debug('No root inputs found in flake metadata');
      return null;
    }

    // Process all inputs from nix flake metadata
    for (const [depName, inputRef] of Object.entries(rootInputs)) {
      const node = metadata.locks?.nodes?.[inputRef as string];
      if (!node?.locked) {
        logger.debug(`No locked data found for ${depName}`);
        continue;
      }

      // Skip indirect and path inputs as they cannot be updated
      if (
        node.original?.type === 'indirect' ||
        node.original?.type === 'path'
      ) {
        logger.debug(
          `Skipping ${depName} - type ${node.original.type} cannot be updated`,
        );
        continue;
      }

      // Get the current digest (rev or narHash)
      const currentDigest = node.locked.rev ?? node.locked.narHash;
      if (!currentDigest) {
        logger.debug(`No digest found for ${depName}`);
        continue;
      }

      deps.push({
        depName,
        currentValue: node.original?.ref,
        currentDigest,
        datasource: NixFlakeDatasource.id,
        packageName: `${flakeDir}#${depName}`,
        rangeStrategy: 'update-lockfile',
      });
    }

    return deps.length ? { deps } : null;
  } catch (err) {
    logger.warn(
      { err, packageFile },
      'Failed to extract dependencies using nix flake metadata',
    );
    return null;
  }
}
