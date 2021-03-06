import {Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef} from '@angular/core';
import {AlbumArgs, AlbumsInfo, CategoryInfo} from '../../services/apis/album.service';
import {Album, MetaData, MetaValue, SubCategory} from '../../services/apis/types';
import {ActivatedRoute, Router} from '@angular/router';
import {Observable} from 'rxjs';
import {first, skip, withLatestFrom} from 'rxjs/operators';
import {WindowService} from '../../services/tools/window.service';
import {storageKeys} from '../../configs';
import {PageService} from '../../services/tools/page.service';
import {CategoryStoreService} from '../../services/business/category.store.service';
import {AlbumStoreService} from '../../services/business/album.store.service';
import {PlayerStoreService} from '../../services/business/player.store.service';

interface CheckedMeta {
  metaRowId: number;
  metaRowName: string;
  metaId: number;
  metaName: string;
}

@Component({
  selector: 'xm-albums',
  templateUrl: './albums.component.html',
  styleUrls: ['./albums.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AlbumsComponent implements OnInit {
  searchParams: AlbumArgs = {
    category: '',
    subcategory: '',
    meta: '',
    sort: 0,
    page: 1,
    perPage: 30
  };
  categoryInfo$: Observable<CategoryInfo>;
  albumsInfo$: Observable<AlbumsInfo>;
  checkedMetas: CheckedMeta[] = [];
  sorts = ['综合排序', '最近更新', '播放最多'];

  constructor(
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private categoryStoreServe: CategoryStoreService,
    private winServe: WindowService,
    private playerStoreServe: PlayerStoreService,
    private pageServe: PageService,
    private albumStoreServe: AlbumStoreService
  ) { }

  ngOnInit(): void {
    this.route.paramMap
      .pipe(withLatestFrom(this.categoryStoreServe.getCategory()))
      .subscribe(([paramMap, category]) => {
      const pinyin = paramMap.get('pinyin');
      this.searchParams.category = pinyin;
      let needSetStatus = false;
      if (pinyin !== category) {
        this.categoryStoreServe.setCategory(pinyin);
        this.clearSubCategory();
        this.unCheckMeta('clear');
      } else {
        const cacheSubCategory = this.winServe.getStorage(storageKeys.subcategoryCode);
        const cacheMetas = this.winServe.getStorage(storageKeys.metas);
        if (cacheSubCategory) {
          needSetStatus = true;
          this.searchParams.subcategory = cacheSubCategory;
        } else {
          this.clearSubCategory();
        }
        if (cacheMetas) {
          needSetStatus = true;
          this.searchParams.meta = cacheMetas;
        }
      }
      this.categoryInfo$ = this.categoryStoreServe.getCategoryInfo();
      this.albumsInfo$ = this.albumStoreServe.getAlbumsInfo();
      this.updatePageData(needSetStatus);
    });
    this.pageServe.setPageInfo(
      '专辑列表',
      'angular10仿喜马拉雅',
      '小说，音乐，教育...'
    );
  }

  playAlbum(event: MouseEvent, albumId: number): void {
    event.stopPropagation();
    this.playerStoreServe.requestAlbum(albumId.toString());
  }

  changeSubCategory(subCategory?: SubCategory): void {
    // console.log('subCategory', subCategory);
    if (subCategory) {
      this.searchParams.subcategory = subCategory.code;
      this.categoryStoreServe.setSubCategory([subCategory.displayValue]);
      this.winServe.setStorage(storageKeys.subcategoryCode, this.searchParams.subcategory);
    } else {
      this.clearSubCategory();
    }
    this.unCheckMeta('clear');
    this.updatePageData();
  }

  changeMeta(row: MetaData, meta: MetaValue): void {
    // row.id_meta.id-
    this.checkedMetas.push({
      metaRowId: row.id,
      metaRowName: row.name,
      metaId: meta.id,
      metaName: meta.displayName
    });
    this.searchParams.meta = this.getMetaParams();
    // console.log('checkedMetas', this.checkedMetas);
    this.winServe.setStorage(storageKeys.metas, this.searchParams.meta);
    this.updateAlbums();
  }

  unCheckMeta(meta: CheckedMeta | 'clear'): void {
    if (meta === 'clear') {
      this.checkedMetas = [];
      this.searchParams.meta = '';
      this.winServe.removeStorage(storageKeys.metas);
    } else {
      const targetIndex = this.checkedMetas.findIndex(item => {
        return (item.metaRowId === meta.metaRowId) && (item.metaId === meta.metaId);
      });
      if (targetIndex > -1) {
        this.checkedMetas.splice(targetIndex, 1);
        this.searchParams.meta = this.getMetaParams();
        this.winServe.setStorage(storageKeys.metas, this.searchParams.meta);
      }
    }
    this.updateAlbums();
  }

  changePage(newPageNum: number): void {
    if (this.searchParams.page !== newPageNum) {
      this.searchParams.page = newPageNum;
      this.updateAlbums();
    }
  }

  private getMetaParams(): string {
    let result = '';
    if (this.checkedMetas.length) {
      this.checkedMetas.forEach(item => {
        result += item.metaRowId + '_' + item.metaId + '-';
      });
    }
    console.log('meta params', result.slice(0, -1));
    return result.slice(0, -1);
  }

  changeSort(index: number): void {
    if (this.searchParams.sort !== index) {
      this.searchParams.sort = index;
      this.updateAlbums();
    }
  }

  showMetaRow(name: string): boolean {
    if (this.checkedMetas.length) {
      return this.checkedMetas.findIndex(item => item.metaRowName === name) === -1;
    }
    return true;
  }

  private updatePageData(needSetStatus = false): void {
    this.albumStoreServe.requestAlbumsInfo(this.searchParams);
    this.categoryStoreServe.initCategoryInfo(this.searchParams);
    if (needSetStatus) {
      this.setStatus();
    }
  }

  private updateAlbums(): void {
    this.albumStoreServe.requestAlbumsInfo(this.searchParams);
  }

  private setStatus(): void {
    this.categoryInfo$.pipe(skip(1), first()).subscribe(res => {
      // console.log('res', res);
      const { subcategories, metadata } = res;
      const subCategory = subcategories.find(item => item.code === this.searchParams.subcategory);
      // console.log('metadata', metadata);
      if (subCategory) {
        this.categoryStoreServe.setSubCategory([subCategory.displayValue]);
      }
      if (this.searchParams.meta) {
        // 19_156-22_4433
        const metasMap = this.searchParams.meta.split('-').map(item => item.split('_'));
        console.log('metasMap', metasMap);
        metasMap.forEach(meta => {
          const targetRow = metadata.find(row => row.id === Number(meta[0]));
          // console.log('targetRow', targetRow);
          // 从详情导航过来的标签不一定存在
          const { id: metaRowId, name, metaValues } = targetRow || metadata[0];
          const targetMeta = metaValues.find(item => item.id === Number(meta[1]));
          const { id, displayName } = targetMeta || metaValues[0];
          this.checkedMetas.push({
            metaRowId,
            metaRowName: name,
            metaId: id,
            metaName: displayName
          });
        });
      }
    });
  }

  private clearSubCategory(): void {
    this.searchParams.subcategory = '';
    this.categoryStoreServe.setSubCategory([]);
    this.winServe.removeStorage(storageKeys.subcategoryCode);
  }


  trackBySubCategories(index: number, item: SubCategory): string { return item.code; }
  trackByMetas(index: number, item: MetaValue): number { return item.id; }
  trackByAlbums(index: number, item: Album): number { return item.albumId; }
}
