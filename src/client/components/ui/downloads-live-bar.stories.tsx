import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { formatSpeed } from '@/downloads/model';
import { Button } from '@/components/ui/button';
import { DownloadsLiveBar } from '@/components/ui/downloads-live-bar';
import { LabelGroup } from '@/components/ui/label-group';
import { PanelInline } from '@/components/ui/panel-inline';
import { RowDownload } from '@/components/ui/row-download';

const speeds = `${formatSpeed(43_620_000)} down · ${formatSpeed(12_900_000)} up`;

const rows = [
  { key: 'a', title: 'Severance S02E01', release: 'Severance.S02E01.Hello.Ms.Cobel.1080p.ATVP.WEB-DL.DDP5.1.H.264-FLUX', progress: 42.7, speed: formatSpeed(8_600_000), eta: '6m', tracker: 'Blutopia', quality: 'WEBDL-1080p' },
  { key: 'b', title: 'Dune: Part Two', release: 'Dune.Part.Two.2024.2160p.UHD.BluRay.REMUX.HDR.HEVC.TrueHD.Atmos.7.1-FGT', progress: 18.2, speed: formatSpeed(31_400_000), eta: '41m', tracker: 'Beyond-HD', quality: 'Remux-2160p' },
  { key: 'c', title: 'The Bear S03E04', release: 'The.Bear.S03E04.Violet.1080p.HULU.WEB-DL.DDP5.1.H.264-NTb', progress: 87, speed: formatSpeed(3_620_000), eta: '1m', tracker: 'Blutopia', quality: 'WEBDL-1080p' },
];

const panel = (
  <PanelInline
    open
    title="Downloads"
    onClose={fn()}
    primary={<Button size="large" onClick={fn()}>Open Downloads</Button>}
    secondary={<Button variant="outline" kbd="Esc" onClick={fn()}>Collapse</Button>}
    hint={speeds}
  >
    <div className="px-5">
      <LabelGroup count={rows.length}>Downloading</LabelGroup>
      <div role="table" aria-label="Downloading" className="border-t border-border">
        {rows.map(({ key, ...row }) => (
          <RowDownload key={key} {...row} state="downloading" stateLabel="Downloading · 14 seeders" />
        ))}
      </div>
    </div>
  </PanelInline>
);

const meta = {
  title: 'UI/DownloadsLiveBar',
  component: DownloadsLiveBar,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  // The bar is fixed to the bottom of the window; the full-height wrapper gives the canvas room for it and its panel.
  decorators: [(Story) => <div className="min-h-screen"><Story /></div>],
  args: {
    count: '3 downloading',
    speeds,
    items: rows.map((row) => ({ key: row.key, name: row.title, percent: row.progress })),
    expanded: false,
    onExpandedChange: fn(),
    panel,
  },
} satisfies Meta<typeof DownloadsLiveBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Downloading: Story = {};

export const Idle: Story = { args: { count: 'Nothing downloading', idle: true, speeds: `${formatSpeed(0)} down · ${formatSpeed(0)} up`, items: [] } };

export const WithProblem: Story = { args: { problem: '2 need you' } };

export const Expanded: Story = { args: { expanded: true } };
